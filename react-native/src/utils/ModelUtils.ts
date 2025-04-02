import { Model, ModelTag } from '../types/Chat.ts';
import { DeepSeekModels } from '../storage/Constants.ts';
import { getTextModel } from '../storage/StorageUtils.ts';

export function getModelTag(model: Model): string {
  if (model.modelTag) {
    return model?.modelTag;
  }
  const isDeepSeek = DeepSeekModels.some(
    deepseekModel => deepseekModel.modelId === model.modelId
  );
  if (isDeepSeek) {
    return ModelTag.DeepSeek;
  }
  if (model.modelId.includes('gpt')) {
    return ModelTag.OpenAI;
  }
  if (getTextModel().modelId.startsWith('ollama-')) {
    return ModelTag.Ollama;
  }
  return ModelTag.Bedrock;
}

export function getModelTagByUserName(
  modelTag: string | undefined,
  userName: string
): string {
  if (modelTag) {
    return modelTag;
  }
  const isDeepSeek = DeepSeekModels.some(
    deepseekModel => deepseekModel.modelId === userName
  );
  if (isDeepSeek) {
    return ModelTag.DeepSeek;
  }
  if (userName.includes('GPT')) {
    return ModelTag.OpenAI;
  }
  if (userName.includes(':')) {
    return ModelTag.Ollama;
  }
  return ModelTag.Bedrock;
}
