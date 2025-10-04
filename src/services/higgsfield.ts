const HIGGSFIELD_API_BASE = 'https://platform.higgsfield.ai';

interface HiggsfieldJobSet {
  id: string;
  type: 'text2image_soul';
  created_at: string;
  jobs: Array<{
    id: string;
    job_set_type: string;
    status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw';
    results: {
      min?: {
        type: string;
        url: string;
      };
      raw?: {
        type: string;
        url: string;
      };
    } | null;
  }>;
  input_params: Record<string, unknown>;
}

/**
 * Generates an image using Higgsfield Soul API
 */
export async function generateImage(prompt: string): Promise<string> {
  const apiKey = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_SECRET;

  if (!apiKey || !secret) {
    throw new Error('HIGGSFIELD_API_KEY or HIGGSFIELD_SECRET is not set');
  }

  const response = await fetch(`${HIGGSFIELD_API_BASE}/v1/text2image/soul`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'hf-api-key': apiKey,
      'hf-secret': secret,
    },
    body: JSON.stringify({
      params: {
        prompt,
        width_and_height: '2048x1152', // 16:9 aspect ratio (closest to 1920x1080)
        enhance_prompt: true,
        quality: '1080p',
        batch_size: 1,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Higgsfield API error: ${error}`);
  }

  const data = (await response.json()) as HiggsfieldJobSet;

  if (!data.id) {
    throw new Error('No job ID returned from Higgsfield');
  }

  return data.id; // Return job ID for polling
}

/**
 * Polls Higgsfield job until image is ready
 */
export async function pollHiggsfieldJob(jobId: string): Promise<string> {
  const apiKey = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_SECRET;

  if (!apiKey || !secret) {
    throw new Error('HIGGSFIELD_API_KEY or HIGGSFIELD_SECRET is not set');
  }

  const maxAttempts = 60; // 5 minutes with 5 second intervals
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await fetch(`${HIGGSFIELD_API_BASE}/v1/job-sets/${jobId}`, {
      method: 'GET',
      headers: {
        'hf-api-key': apiKey,
        'hf-secret': secret,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Higgsfield polling error: ${error}`);
    }

    const data = (await response.json()) as HiggsfieldJobSet;
    const job = data.jobs?.[0];

    if (!job) {
      throw new Error('No job found in response');
    }

    if (job.status === 'failed') {
      throw new Error('Image generation failed');
    }

    if (job.status === 'nsfw') {
      throw new Error('Image generation rejected: NSFW content detected');
    }

    if (job.status === 'completed' && job.results?.raw?.url) {
      return job.results.raw.url;
    }

    // Wait 5 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error('Image generation timeout');
}
