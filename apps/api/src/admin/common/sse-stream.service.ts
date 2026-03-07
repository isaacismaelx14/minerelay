import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';

type CleanupHandler = () => void;

export type SseConnection = {
  send: (event: string, data: unknown) => void;
  close: () => void;
  onClose: (handler: CleanupHandler) => void;
};

@Injectable()
export class SseStreamService {
  open(request: Request, response: Response): SseConnection {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    let closed = false;
    const cleanupHandlers = new Set<CleanupHandler>();

    const send = (event: string, data: unknown) => {
      if (closed || response.writableEnded) {
        return;
      }
      response.write(`event: ${event}\n`);
      response.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const heartbeat = setInterval(() => {
      send('ping', { ts: Date.now() });
    }, 15000);

    const close = () => {
      if (closed) {
        return;
      }
      closed = true;
      clearInterval(heartbeat);
      for (const handler of cleanupHandlers) {
        handler();
      }
      cleanupHandlers.clear();
      if (!response.writableEnded) {
        response.end();
      }
    };

    request.on('close', close);

    return {
      send,
      close,
      onClose: (handler: CleanupHandler) => {
        cleanupHandlers.add(handler);
      },
    };
  }
}
