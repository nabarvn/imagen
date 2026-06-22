export const getOpenAI = async () => {
  const { openai } = await import("./openai.js");
  return openai;
};

export const getImageProcessor = async () => {
  const { ImageProcessor } = await import("./sharp.js");
  return ImageProcessor;
};
