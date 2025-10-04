import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { GoogleGenAI } from '@google/genai';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from '../lib/logger.js';

/**
 * Analyzes changelog and generates a video script
 */
export async function analyzeChangelog(changelog: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Analyze this changelog and create a concise, engaging summary for a video script. Focus on the most important features and changes. Keep it under 100 words and make it exciting for developers.\n\nChangelog:\n${changelog}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
    },
  });

  const text = result.response.text();
  if (!text) {
    throw new Error('No text generated from Gemini');
  }

  logger.debug('Generated script:', text);
  return text.trim();
}

/**
 * Generates an image prompt from the video script
 */
export async function generateImagePrompt(script: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Create a detailed, photorealistic image prompt for a professional software release announcement. The image should be suitable for a tech company's video thumbnail. Based on this script:\n\n${script}\n\nProvide only the image prompt, no explanation.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.8,
    },
  });

  const text = result.response.text();
  if (!text) {
    throw new Error('No image prompt generated from Gemini');
  }

  logger.debug('Generated image prompt:', text);
  return text.trim();
}

/**
 * Downloads image from URL and saves to temporary file
 */
async function downloadImage(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generates video using Veo 3 API with image-to-video
 */
export async function generateVideo(
  imageUrl: string,
  prompt: string,
  aspectRatio: '16:9' | '9:16',
  resolution: '720p' | '1080p'
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const veoAI = new GoogleGenAI({ apiKey });

  // Download image
  logger.debug('Downloading image from:', imageUrl);
  const imageBuffer = await downloadImage(imageUrl);

  // Convert to base64
  const imageBase64 = imageBuffer.toString('base64');
  logger.debug('Image converted to base64, size:', imageBase64.length);

  // Generate video using Veo SDK with imageBytes
  logger.info('Generating video with Veo SDK...');
  let operation = await veoAI.models.generateVideos({
    model: 'veo-3.0-fast-generate-001',
    prompt,
    image: {
      imageBytes: imageBase64,
      mimeType: 'image/png',
    },
    config: {
      aspectRatio,
      resolution,
    },
  });

  logger.debug('Veo operation started:', operation.name);

  // Poll until completion
  const maxAttempts = 60; // 10 minutes with 10 second intervals
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Get operation status
    operation = await veoAI.operations.getVideosOperation({ operation });

    logger.debug(`Polling attempt ${attempts + 1}:`, operation.done ? 'Done!' : 'Processing...');

    if (operation.done) {
      // Extract video URI from completed operation
      // @ts-ignore
      if (operation.response?.generatedVideos?.[0]?.video?.uri) {
        // @ts-ignore
        let videoUri = operation.response.generatedVideos[0].video.uri;

        // Add API key to the URI if not already present
        if (!videoUri.includes('key=')) {
          const separator = videoUri.includes('?') ? '&' : '?';
          videoUri = `${videoUri}${separator}key=${apiKey}`;
        }

        logger.info('Video generation completed');
        return videoUri;
      }

      throw new Error(`Operation completed but no video URI found. Response: ${JSON.stringify(operation.response)}`);
    }

    // Wait 10 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 10000));
    attempts++;
  }

  throw new Error('Video generation timeout');
}

/**
 * Polls for video generation completion (legacy - not used)
 */
export async function pollVeoOperation(operationName: string): Promise<string> {
  // This function is no longer used - polling is done in generateVideo
  throw new Error('pollVeoOperation should not be called - polling is done in generateVideo');
}
