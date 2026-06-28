import { BadRequestException } from '@nestjs/common';

export function parseJsonObject(value: unknown, fieldName: string): Record<string, unknown> | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} must be a JSON object`);
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new BadRequestException(`${fieldName} must be a valid JSON object`);
  }
}
