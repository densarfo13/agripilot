/**
 * Object storage abstraction for satellite/drone imagery.
 *
 * Swappable backend: LocalStorageProvider (default) or S3StorageProvider.
 * Set STORAGE_PROVIDER=s3 + S3_BUCKET + AWS credentials to use S3.
 */

import { createReadStream, createWriteStream, existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { join, basename } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';

// ── Interface ──

export interface StorageProvider {
  /** Upload a buffer or stream, return the public/internal URL. */
  put(key: string, data: Buffer | Readable, contentType?: string): Promise<string>;
  /** Get a readable stream for a stored object. */
  get(key: string): Promise<Readable>;
  /** Delete a stored object. Returns true if deleted, false if not found. */
  delete(key: string): Promise<boolean>;
  /** Check if an object exists. */
  exists(key: string): Promise<boolean>;
}

/** Generate a storage key with UUID prefix to avoid collisions. */
export function storageKey(prefix: string, originalName: string): string {
  const ext = originalName.includes('.') ? '.' + originalName.split('.').pop() : '';
  return `${prefix}/${randomUUID()}${ext}`;
}

// ── Local filesystem implementation ──

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.env.UPLOAD_DIR || './uploads/intelligence';
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async put(key: string, data: Buffer | Readable, _contentType?: string): Promise<string> {
    const filePath = join(this.baseDir, key);
    const dir = join(this.baseDir, key.substring(0, key.lastIndexOf('/')));
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    if (Buffer.isBuffer(data)) {
      const { writeFileSync } = await import('fs');
      writeFileSync(filePath, data);
    } else {
      const writable = createWriteStream(filePath);
      await pipeline(data, writable);
    }
    return filePath;
  }

  async get(key: string): Promise<Readable> {
    const filePath = join(this.baseDir, key);
    return createReadStream(filePath);
  }

  async delete(key: string): Promise<boolean> {
    const filePath = join(this.baseDir, key);
    try {
      unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      statSync(join(this.baseDir, key));
      return true;
    } catch {
      return false;
    }
  }
}

// ── S3 implementation (requires @aws-sdk/client-s3) ──

export class S3StorageProvider implements StorageProvider {
  private bucket: string;
  private client: any;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'farroway-intelligence';
    // Lazy-load AWS SDK to avoid hard dependency
    try {
      const { S3Client } = require('@aws-sdk/client-s3');
      this.client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
      });
    } catch {
      throw new Error('S3StorageProvider requires @aws-sdk/client-s3. Run: npm install @aws-sdk/client-s3');
    }
  }

  async put(key: string, data: Buffer | Readable, contentType?: string): Promise<string> {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const body = Buffer.isBuffer(data) ? data : await streamToBuffer(data);
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
      }));
    } catch (err) {
      console.error(`[storage] S3 put failed for key=${key}:`, err);
      throw err;
    }
    return `s3://${this.bucket}/${key}`;
  }

  async get(key: string): Promise<Readable> {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    return response.Body as Readable;
  }

  async delete(key: string): Promise<boolean> {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    const { HeadObjectCommand } = require('@aws-sdk/client-s3');
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch {
      return false;
    }
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ── Factory ──

let _instance: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (!_instance) {
    const provider = process.env.STORAGE_PROVIDER || 'local';
    _instance = provider === 's3' ? new S3StorageProvider() : new LocalStorageProvider();
    console.log(`[storage] Using ${provider} storage provider`);
  }
  return _instance;
}
