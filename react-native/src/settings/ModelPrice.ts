import { Usage, UsagePrice } from '../types/Chat.ts';

export const getUsagePrice = (usage: Usage): UsagePrice => {
  const usagePrice: UsagePrice = {
    modelName: usage.modelName,
    inputPrice: 0,
    outputPrice: 0,
    totalPrice: 0,
    smallImagePrice: 0,
    mediumImagePrice: 0,
    largeImagePrice: 0,
  };
  if (usage.imageCount || usage.smallImageCount || usage.largeImageCount) {
    if (usage.smallImageCount) {
      usagePrice.smallImagePrice =
        usage.smallImageCount *
        getImagePrice(usage.modelName as keyof ImageModelPrices, 'small');
    }

    if (usage.imageCount) {
      usagePrice.mediumImagePrice =
        usage.imageCount *
        getImagePrice(usage.modelName as keyof ImageModelPrices, 'medium');
    }

    if (usage.largeImageCount) {
      usagePrice.largeImagePrice =
        usage.largeImageCount *
        getImagePrice(usage.modelName as keyof ImageModelPrices, 'large');
    }
    usagePrice.totalPrice = Number(
      (
        usagePrice.smallImagePrice +
        usagePrice.mediumImagePrice +
        usagePrice.largeImagePrice
      ).toFixed(2)
    );
  } else {
    usagePrice.inputPrice = Number(
      (
        (usage.inputTokens *
          (ModelPrice.textModelPrices[usage.modelName]?.inputTokenPrice ?? 0)) /
        1000
      ).toFixed(6)
    );

    usagePrice.outputPrice = Number(
      (
        (usage.outputTokens *
          (ModelPrice.textModelPrices[usage.modelName]?.outputTokenPrice ??
            0)) /
        1000
      ).toFixed(6)
    );
    usagePrice.totalPrice = Number(
      (usagePrice.inputPrice + usagePrice.outputPrice).toFixed(2)
    );
  }
  return usagePrice;
};

function getImagePrice(
  modelName: keyof ImageModelPrices,
  size: 'small' | 'medium' | 'large'
): number {
  const model = ModelPrice.imageModelPrices[modelName];
  if (!model) {
    return 0;
  }
  return size in model ? model[size as keyof typeof model] : 0;
}

export const ModelPrice: ModelPriceType = {
  textModelPrices: {
    'Titan Text G1 - Lite': {
      inputTokenPrice: 0.00015,
      outputTokenPrice: 0.0002,
    },
    'Titan Text G1 - Express': {
      inputTokenPrice: 0.0002,
      outputTokenPrice: 0.0006,
    },
    'Titan Text G1 - Premier': {
      inputTokenPrice: 0.0005,
      outputTokenPrice: 0.0015,
    },
    'Nova Pro': {
      inputTokenPrice: 0.0008,
      outputTokenPrice: 0.0032,
    },
    'Nova Lite': {
      inputTokenPrice: 0.00006,
      outputTokenPrice: 0.00024,
    },
    'Nova Micro': {
      inputTokenPrice: 0.000035,
      outputTokenPrice: 0.00014,
    },
    'Claude 3.5 Sonnet v2': {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
    'Claude 3.5 Haiku': {
      inputTokenPrice: 0.0008,
      outputTokenPrice: 0.004,
    },
    'Claude Instant': {
      inputTokenPrice: 0.0008,
      outputTokenPrice: 0.0024,
    },
    Claude: {
      inputTokenPrice: 0.008,
      outputTokenPrice: 0.024,
    },
    'Claude 3 Sonnet': {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
    'Claude 3 Haiku': {
      inputTokenPrice: 0.00025,
      outputTokenPrice: 0.00125,
    },
    'Claude 3 Opus': {
      inputTokenPrice: 0.015,
      outputTokenPrice: 0.075,
    },
    'Claude 3.5 Sonnet': {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
    Command: {
      inputTokenPrice: 0.0015,
      outputTokenPrice: 0.002,
    },
    'Command R': {
      inputTokenPrice: 0.0005,
      outputTokenPrice: 0.0015,
    },
    'Command R+': {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
    'Command Light': {
      inputTokenPrice: 0.0003,
      outputTokenPrice: 0.0006,
    },
    'Llama 3 8B Instruct': {
      inputTokenPrice: 0.0003,
      outputTokenPrice: 0.0006,
    },
    'Llama 3 70B Instruct': {
      inputTokenPrice: 0.00265,
      outputTokenPrice: 0.0035,
    },
    'Llama 3.1 8B Instruct': {
      inputTokenPrice: 0.00022,
      outputTokenPrice: 0.00022,
    },
    'Llama 3.1 70B Instruct': {
      inputTokenPrice: 0.00072,
      outputTokenPrice: 0.00072,
    },
    'Llama 3.1 405B Instruct': {
      inputTokenPrice: 0.0024,
      outputTokenPrice: 0.0024,
    },
    'Llama 3.2 1B Instruct': {
      inputTokenPrice: 0.0001,
      outputTokenPrice: 0.0001,
    },
    'Llama 3.2 3B Instruct': {
      inputTokenPrice: 0.00015,
      outputTokenPrice: 0.00015,
    },
    'Llama 3.2 11B Instruct': {
      inputTokenPrice: 0.00016,
      outputTokenPrice: 0.00016,
    },
    'Llama 3.2 90B Instruct': {
      inputTokenPrice: 0.00072,
      outputTokenPrice: 0.00072,
    },
    'Mistral 7B Instruct': {
      inputTokenPrice: 0.00015,
      outputTokenPrice: 0.0002,
    },
    'Mixtral 8x7B Instruct': {
      inputTokenPrice: 0.00045,
      outputTokenPrice: 0.0007,
    },
    'Mistral Small (24.02)': {
      inputTokenPrice: 0.001,
      outputTokenPrice: 0.003,
    },
    'Mistral Large (24.02)': {
      inputTokenPrice: 0.004,
      outputTokenPrice: 0.012,
    },
    'Mistral Large (24.07)': {
      inputTokenPrice: 0.002,
      outputTokenPrice: 0.006,
    },
    'Jamba-Instruct': {
      inputTokenPrice: 0.0005,
      outputTokenPrice: 0.0007,
    },
    'Jamba 1.5 Large': {
      inputTokenPrice: 0.002,
      outputTokenPrice: 0.008,
    },
    'Jamba 1.5 Mini': {
      inputTokenPrice: 0.0002,
      outputTokenPrice: 0.0004,
    },
  },
  imageModelPrices: {
    'Titan Image Generator G1': {
      small: 0.008,
      medium: 0.01,
    },
    'Titan Image Generator G1 v2': {
      small: 0.008,
      medium: 0.01,
    },
    'Nova Canvas': {
      medium: 0.04,
      large: 0.06,
    },
    'SDXL 1.0': {
      medium: 0.04,
    },
    'SD3 Large 1.0': {
      medium: 0.08,
    },
    'Stable Image Core 1.0': {
      medium: 0.04,
    },
    'Stable Image Ultra 1.0': {
      medium: 0.14,
    },
  },
};

interface ModelPriceType {
  textModelPrices: Record<
    string,
    { inputTokenPrice: number; outputTokenPrice: number }
  >;
  imageModelPrices: ImageModelPrices;
}

type ImageModelPrices = {
  'Titan Image Generator G1': {
    small: number;
    medium: number;
  };
  'Titan Image Generator G1 v2': {
    small: number;
    medium: number;
  };
  'Nova Canvas': {
    medium: number;
    large: number;
  };
  'SDXL 1.0': {
    medium: number;
  };
  'SD3 Large 1.0': {
    medium: number;
  };
  'Stable Image Core 1.0': {
    medium: number;
  };
  'Stable Image Ultra 1.0': {
    medium: number;
  };
};

export function getTotalCost(usage: Usage[]) {
  return usage
    .reduce((sum, model) => sum + getUsagePrice(model).totalPrice, 0)
    .toFixed(2);
}

export function getTotalInputTokens(usage: Usage[]) {
  return usage
    .reduce((sum, model) => sum + (model.inputTokens || 0), 0)
    .toLocaleString();
}

export function getTotalInputPrice(usage: Usage[]) {
  return usage
    .reduce((sum, model) => sum + getUsagePrice(model).inputPrice, 0)
    .toFixed(6);
}

export function getTotalOutputTokens(usage: Usage[]) {
  return usage
    .reduce((sum, model) => sum + (model.outputTokens || 0), 0)
    .toLocaleString();
}

export function getTotalOutputPrice(usage: Usage[]) {
  return usage
    .reduce((sum, model) => sum + getUsagePrice(model).outputPrice, 0)
    .toFixed(6);
}

export function getTotalImageCount(usage: Usage[]) {
  return usage
    .reduce(
      (sum, model) =>
        sum +
        (model.smallImageCount || 0) +
        (model.imageCount || 0) +
        (model.largeImageCount || 0),
      0
    )
    .toLocaleString();
}

export function getTotalImagePrice(usage: Usage[]) {
  return usage
    .reduce(
      (sum, model) =>
        sum +
        (getUsagePrice(model).smallImagePrice || 0) +
        (getUsagePrice(model).mediumImagePrice || 0) +
        (getUsagePrice(model).largeImagePrice || 0),
      0
    )
    .toFixed(6);
}