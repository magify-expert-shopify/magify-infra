export class AddUrlDto {
  url!: string;
  sourceFile?: string;
  scan?: boolean;
  timeoutMs?: number;
}
