import base64
from typing import List
import uvicorn
from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import StreamingResponse, PlainTextResponse
import boto3
import json
import random
import os
import re
from pydantic import BaseModel
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Annotated
from urllib.request import urlopen, Request
import time

app = FastAPI()
security = HTTPBearer()

auth_token = ''
CACHE_DURATION = 120000
cache = {
    "latest_version": "",
    "last_check": 0
}


class ImageRequest(BaseModel):
    prompt: str
    modelId: str
    region: str
    width: int
    height: int


class ConverseRequest(BaseModel):
    messages: List[dict] = []
    modelId: str
    region: str


class ModelsRequest(BaseModel):
    region: str


class UpgradeRequest(BaseModel):
    os: str
    version: str


def get_api_key_from_ssm(use_cache_token: bool):
    global auth_token
    if use_cache_token and auth_token != '':
        return auth_token
    ssm_client = boto3.client('ssm')
    api_key_name = os.environ['API_KEY_NAME']
    response = ssm_client.get_parameter(
        Name=api_key_name,
        WithDecryption=True
    )
    auth_token = response['Parameter']['Value']
    return auth_token


def verify_api_key(credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
                   use_cache_token: bool = True):
    if credentials.credentials != get_api_key_from_ssm(use_cache_token):
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return credentials.credentials


def verify_and_refresh_token(credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]):
    return verify_api_key(credentials, use_cache_token=False)


@app.post("/api/converse")
async def converse(request: ConverseRequest,
                   _: Annotated[str, Depends(verify_api_key)]):
    model_id = request.modelId
    region = request.region
    if region == '':
        region = request.region

    try:
        client = boto3.client("bedrock-runtime",
                              region_name=region)
        max_tokens = 4096
        if model_id.startswith('meta.llama'):
            max_tokens = 2048
        for message in request.messages:
            if message["role"] == "user":
                for content in message["content"]:
                    if 'image' in content:
                        image_bytes = base64.b64decode(content['image']['source']['bytes'])
                        content['image']['source']['bytes'] = image_bytes
                    if 'document' in content:
                        image_bytes = base64.b64decode(content['document']['source']['bytes'])
                        content['document']['source']['bytes'] = image_bytes
        command = {
            "inferenceConfig": {"maxTokens": max_tokens},
            "messages": request.messages,
            "modelId": model_id
        }

        def event_generator():
            try:
                response = client.converse_stream(**command)
                for item in response['stream']:
                    if "contentBlockDelta" in item:
                        text = item["contentBlockDelta"].get("delta", {}).get("text", "")
                        if text:
                            yield text
                    elif "metadata" in item:
                        yield "\n" + json.dumps(item["metadata"]["usage"])
            except Exception as err:
                yield f"Error: {str(err)}"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    except Exception as error:
        return PlainTextResponse(f"Error: {str(error)}", status_code=500)


@app.post("/api/image")
async def gen_image(request: ImageRequest,
                    _: Annotated[str, Depends(verify_api_key)]):
    model_id = request.modelId
    prompt = request.prompt
    width = request.width
    height = request.height
    region = request.region
    client = boto3.client("bedrock-runtime",
                          region_name=region)
    if contains_chinese(prompt):
        prompt = get_english_prompt(client, prompt)
    return get_image(client, model_id, prompt, width, height)


@app.post("/api/models")
async def get_models(request: ModelsRequest,
                     _: Annotated[str, Depends(verify_api_key)]):
    region = request.region
    client = boto3.client("bedrock",
                          region_name=region)

    try:
        response = client.list_foundation_models()
        if response.get("modelSummaries"):
            model_names = set()
            text_model = []
            image_model = []
            for model in response["modelSummaries"]:
                need_cross_region = "INFERENCE_PROFILE" in model["inferenceTypesSupported"]
                if (model["modelLifecycle"]["status"] == "ACTIVE"
                        and ("ON_DEMAND" in model["inferenceTypesSupported"] or need_cross_region)
                        and not model["modelId"].endswith("k")
                        and model["modelName"] not in model_names):
                    if ("TEXT" in model.get("outputModalities", []) and
                            model.get("responseStreamingSupported")):
                        if need_cross_region:
                            model_id = region.split("-")[0] + "." + model["modelId"]
                        else:
                            model_id = model["modelId"]
                        text_model.append({
                            "modelId": model_id,
                            "modelName": model["modelName"]
                        })
                    elif "IMAGE" in model.get("outputModalities", []):
                        image_model.append({
                            "modelId": model["modelId"],
                            "modelName": model["modelName"]
                        })
                    model_names.add(model["modelName"])
            return {"textModel": text_model, "imageModel": image_model}
        else:
            return []
    except Exception as e:
        print(f"bedrock error: {e}")
        return {"error": str(e)}


@app.post("/api/upgrade")
async def upgrade(request: UpgradeRequest,
                  _: Annotated[str, Depends(verify_and_refresh_token)]):
    new_version = get_latest_version()
    total_number = calculate_version_total(request.version)
    need_upgrade = False
    url = ''
    if total_number > 0:
        need_upgrade = total_number < calculate_version_total(new_version)
        if need_upgrade:
            download_prefix = "https://github.com/aws-samples/swift-chat/releases/download/"
            if request.os == 'android':
                url = download_prefix + new_version + "/SwiftChat.apk"
            elif request.os == 'mac':
                url = download_prefix + new_version + "/SwiftChat.dmg"
    return {"needUpgrade": need_upgrade, "version": new_version, "url": url}


def calculate_version_total(version: str) -> int:
    versions = version.split(".")
    total_number = 0
    if len(versions) == 3:
        total_number = int(versions[0]) * 10000 + int(versions[1]) * 100 + int(versions[2])
    return total_number


def get_latest_version() -> str:
    timestamp = int(time.time() * 1000)
    if cache["last_check"] > 0 and timestamp - cache["last_check"] < CACHE_DURATION:
        return cache["latest_version"]
    req = Request(
        f"https://api.github.com/repos/aws-samples/swift-chat/tags",
        headers={
            'User-Agent': 'Mozilla/5.0'
        }
    )
    try:
        with urlopen(req) as response:
            content = response.read().decode('utf-8')
            latest_version = json.loads(content)[0]['name']
            cache["latest_version"] = latest_version
            cache["last_check"] = timestamp
            return json.loads(content)[0]['name']
    except Exception as error:
        print(f"Error occurred when get github tag: {error}")
    return '0.0.0'


def get_image(client, model_id, prompt, width, height):
    try:
        seed = random.randint(0, 2147483647)
        native_request = {}
        if model_id.startswith("amazon"):
            native_request = {
                "taskType": "TEXT_IMAGE",
                "textToImageParams": {"text": prompt},
                "imageGenerationConfig": {
                    "numberOfImages": 1,
                    "quality": "standard",
                    "cfgScale": 8.0,
                    "height": height,
                    "width": width,
                    "seed": seed,
                },
            }
        elif model_id.startswith("stability.stable-diffusion-xl-v1"):
            native_request = {
                "text_prompts": [{"text": prompt}],
                "style_preset": "photographic",
                "seed": seed,
                "cfg_scale": 10,
                "steps": 50,
                "height": height,
                "width": width,
            }
        elif (model_id.startswith("stability.sd3-large-v1:0") or
              model_id.startswith("stability.stable-image-ultra-v1:0") or
              model_id.startswith("stability.stable-image-core-v1:0")):
            native_request = {
                "prompt": prompt,
                "aspect_ratio": "1:1",
                "output_format": "png",
                "mode": "text-to-image",
            }
        request = json.dumps(native_request)
        response = client.invoke_model(modelId=model_id, body=request)
        model_response = json.loads(response["body"].read())
        if model_id.startswith("stability.stable-diffusion-xl-v1"):
            base64_image_data = model_response["artifacts"][0]["base64"]
        else:
            base64_image_data = model_response["images"][0]
        return {"image": base64_image_data}
    except Exception as error:
        error_msg = str(error)
        print(f"Error occurred: {error_msg}")
        return {"error": error_msg}


def get_english_prompt(client, prompt):
    new_prompt = f"Translate to English image prompt, output only translation:\n[{prompt}]"
    try:
        native_request = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 256,
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": new_prompt}],
                }
            ],
        }
        request = json.dumps(native_request)
        response = client.invoke_model(modelId="anthropic.claude-3-haiku-20240307-v1:0", body=request)
        model_response = json.loads(response["body"].read())
        return model_response["content"][0]["text"]
    except Exception as error:
        print(f"Error translate prompt to english: {error}")
        raise HTTPException(status_code=400, detail=f"Error: translate failed, {error}")


def contains_chinese(text):
    pattern = re.compile(r'[\u4e00-\u9fff]')
    match = pattern.search(text)
    return match is not None


if __name__ == "__main__":
    print("Starting webserver...")
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
