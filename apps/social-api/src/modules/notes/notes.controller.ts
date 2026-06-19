import { Body, Controller, Post } from '@nestjs/common';
import { NoteStatus } from '../../../generated/prisma/client';
import { NotesService } from './notes.service';

type CreateNoteBody = {
  title: string;
  status: NoteStatus;
};

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(@Body() body: CreateNoteBody) {
    return this.notesService.create(body);
  }
}
