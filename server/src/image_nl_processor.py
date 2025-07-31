import random
import json
import base64
from fastapi import HTTPException


def get_native_request_with_ref_image(client, prompt, ref_images, width, height):
    result = get_analyse_result(client, prompt, get_prompt())
    try:
        result_objet = json.loads(result)
        seed = random.randint(0, 2147483647)
        if result_objet['target_task_type'] == 'BACKGROUND_REMOVAL':
            return {
                "taskType": "BACKGROUND_REMOVAL",
                "backgroundRemovalParams": {
                    "image": ref_images[0]['source']['bytes'],
                },
            }
        elif result_objet['target_task_type'] == 'TEXT_IMAGE':
            return {
                "taskType": "TEXT_IMAGE",
                "textToImageParams": {"text": result_objet['optimized_prompt']},
                "imageGenerationConfig": {
                    "numberOfImages": 1,
                    "quality": "standard",
                    "cfgScale": 6.5,
                    "height": height,
                    "width": width,
                    "seed": seed,
                },
            }
        elif result_objet['target_task_type'] == 'COLOR_GUIDED_GENERATION':
            return {
                "taskType": "COLOR_GUIDED_GENERATION",
                "colorGuidedGenerationParams": {
                    "text": result_objet['optimized_prompt'],
                    "negativeText": "bad quality, low res",
                    "referenceImage": ref_images[0]['source']['bytes'],
                    "colors": result_objet['colors']
                },
                "imageGenerationConfig": {
                    "numberOfImages": 1,
                    "cfgScale": 6.5,
                    "height": height,
                    "width": width
                }
            }
        elif result_objet['target_task_type'] == 'IMAGE_VARIATION':
            return {
                "taskType": "IMAGE_VARIATION",
                "imageVariationParams": {
                    "text": result_objet['optimized_prompt'],
                    "negativeText": "bad quality, low resolution, cartoon",
                    "images": [ref_images[0]['source']['bytes']],
                    "similarityStrength": 0.7,
                },
                "imageGenerationConfig": {
                    "numberOfImages": 1,
                    "height": height,
                    "width": width,
                    "cfgScale": 6.5
                }
            }
        elif result_objet['target_task_type'] == 'INPAINTING':
            return {
                "taskType": "INPAINTING",
                "inPaintingParams": {
                    "text": result_objet['optimized_prompt'],
                    "negativeText": "bad quality, low res",
                    "image": ref_images[0]['source']['bytes'],
                    "maskPrompt": result_objet['mask_prompt'],
                },
                "imageGenerationConfig": {
                    "numberOfImages": 1,
                    "height": height,
                    "width": width,
                    "cfgScale": 6.5
                }
            }
        else:
            raise HTTPException(status_code=400, detail=f"Error: ${result_objet['error']}")
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Error: image analyse failed, {error}")


def get_analyse_result(client, prompt, global_prompt, image=None):
    try:
        content = [{"text": prompt}]
        if image is not None:
            image_bytes = base64.b64decode(image)
            content.append({"image": {"format": "jpeg", "source": {"bytes": image_bytes}}})

        messages = [
            {
                "role": "user",
                "content": content
            }
        ]
        command = {
            "inferenceConfig": {"maxTokens": 512},
            "messages": messages,
            "system": [
                {"text": global_prompt}
            ],
            "modelId": 'us.amazon.nova-lite-v1:0'
        }
        response = client.converse(**command)
        complete_res = ''
        for item in response['output']['message']['content']:
            if 'text' in item:
                complete_res += item['text']
        return complete_res
    except Exception as error:
        print(f"Error analyse by nova-lite: {error}")
        raise HTTPException(status_code=400, detail=f"Error: analyse failed, {error}")


def get_native_request_with_virtual_try_on(client, prompt, ref_images, width, height):
    garment_image = ref_images[1]['source']['bytes']
    garment_class = get_garment_class(client, prompt, garment_image)
    seed = random.randint(0, 2147483647)

    return {
        "taskType": "VIRTUAL_TRY_ON",
        "virtualTryOnParams": {
            "sourceImage": ref_images[0]['source']['bytes'],
            "referenceImage": garment_image,
            "returnMask": True,
            "maskType": "GARMENT",
            "garmentBasedMask": {
                "garmentClass": garment_class,
            },
        },
        "imageGenerationConfig": {
            "seed": seed,
        },
    }


def get_garment_class(client, prompt, garment_image):
    system_prompt = get_garment_class_prompt()
    try:
        result = get_analyse_result(client, prompt, system_prompt, garment_image)
        return json.loads(result).get('garment_class', 'FULL_BODY')
    except Exception as error:
        print(f'Error analyzing garment class: {error}')
        return 'FULL_BODY'


def get_garment_class_prompt():
    return """You are a virtual try-on classification assistant. Analyze user input text and image to identify the garment type.

Categories of garment types are:
- UPPER_BODY: shirts, t-shirts, jackets, coats, sweaters, etc.
- LOWER_BODY: pants, shorts, skirts, jeans, etc.
- FOOTWEAR: shoes, boots, sneakers, sandals, etc.
- FULL_BODY: dresses, suits, full outfits, or unclear cases

Return ONLY a JSON response in this exact format:
{
  "garment_class": "TYPE"
}

Note:
- TYPE must be "UPPER_BODY", "LOWER_BODY", "FOOTWEAR", or "FULL_BODY"
- If multiple wearable items appear in the image, only consider the main subject in the center of the image.
- Default to "FULL_BODY" if the garment type is not clearly upper body, lower body, or footwear.

IMPORTANT:
DO NOT include any explanatory text or markdown in your response. Your entire response must be a single, valid JSON object."""


def get_prompt():
    return """You are an AI assistant that helps users analyze image tasks and generate structured JSON responses. Your role is to:

1. Analyze user's input prompt
2. Determine the most appropriate image task type from these 5 types:

    - TEXT_IMAGE: Generate completely new image based on text prompt and giving image
    - COLOR_GUIDED_GENERATION: Generate image with specific color palette/style
    - IMAGE_VARIATION: Create variations of entire input image
    - INPAINTING: Remove, replace or modify specific objects/areas while keeping rest of image intact (e.g. remove person/object, replace item, modify part of image)
    - BACKGROUND_REMOVAL: Remove entire background, leaving only main subject with transparency

    Quick decision strategy - check these 5 rules in sequence:

        1. Only classify as BACKGROUND_REMOVAL if user specifically mentions "remove background" or "make background transparent"

        2. If user mentions image variations or similar style/alternatives, it must be IMAGE_VARIATION

        3. If user wants to generate content based on specific colors/palette, it must be COLOR_GUIDED_GENERATION

        4. If user wants to replace, modify or remove specific objects/areas within the image, it must be INPAINTING

        5. Only classify as TEXT_IMAGE if user wants to create new image following reference image layout

        Check these rules in order until a match is found. If no rules match using None instead.

3. Generate a JSON response with:
    - target_task_type: The matched task type, or "None" if no match
    - error: If no match, return "The current operation on the image is not supported. You can try these operations: Generate image, Generate variation, Remove Object, Replace Object, Remove Background."
    - optimized_prompt: Optimize the user's input prompt in English based on the detected task type
    - colors: Only For COLOR_GUIDED_GENERATION, array of 1-4 hex color codes (e.g. ["#ff8080"])
    - mask_prompt: Only For INPAINTING, the prompt is the mentioned subject, e.g.
        1. for INPAINTING, if user prompt: 'Modernize the windows of the house' the mask_prompt should be "windows"

Example JSON response:
{
  "target_task_type": "INPAINTING",
  "optimized_prompt": "replace the red car with a blue sports car",
  "mask_prompt": "windows",
  "colors":["#ff8080", "#ffb280"],
  "error": ""
}

Out put rules:
1. Only include relevant fields based on the matched task type. Analyze the user's intent carefully to determine the most appropriate task type and generate optimal outputs.
2. Output content must start with "{" and end with "}". DO NOT use "```json" markup/format for any output responses.
3. DO NOT include any explanatory text or markdown in your response. Your entire response must be a single, valid JSON object.
"""
