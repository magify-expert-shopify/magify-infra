import { NoteStatus } from '../../../../generated/prisma/client';

export type CreateNoteDto = {
  title: string;
  status: NoteStatus;
};
