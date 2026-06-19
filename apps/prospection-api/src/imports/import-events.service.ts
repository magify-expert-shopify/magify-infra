import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class ImportEventsService {
  private readonly streams = new Map<number, Subject<MessageEvent>>();
  private readonly globalStream = new Subject<MessageEvent>();

  stream(importId: number): Observable<MessageEvent> {
    return this.getStream(importId).asObservable();
  }

  streamAll(): Observable<MessageEvent> {
    return this.globalStream.asObservable();
  }

  emit(importId: number, type: string, data: string | object) {
    const event = {
      type,
      data,
    };

    this.getStream(importId).next(event);
    this.globalStream.next(event);
  }

  private getStream(importId: number) {
    const current = this.streams.get(importId);
    if (current) {
      return current;
    }

    const next = new Subject<MessageEvent>();
    this.streams.set(importId, next);
    return next;
  }
}
