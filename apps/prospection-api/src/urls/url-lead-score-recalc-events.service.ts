import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class UrlLeadScoreRecalcEventsService {
  private readonly streamSubject = new Subject<MessageEvent>();

  stream(): Observable<MessageEvent> {
    return this.streamSubject.asObservable();
  }

  emit(type: string, data: string | object) {
    this.streamSubject.next({
      type,
      data,
    });
  }
}
