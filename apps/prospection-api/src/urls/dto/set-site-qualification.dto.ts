import { SITE_QUALIFICATION_POSITIONINGS, type SiteObservation, type SiteQualificationChecklist, type SiteQualificationPositioning } from 'src/site-qualifications/site-qualifications';

export class SetSiteQualificationDto {
  positioning!: SiteQualificationPositioning;
  abandonReason?: string | null;
  mainObservationKey?: string | null;
  observations?: SiteObservation[];
  verificationChecklist?: Partial<SiteQualificationChecklist>;
}

export function isSiteQualificationPositioning(value: unknown): value is SiteQualificationPositioning {
  return SITE_QUALIFICATION_POSITIONINGS.includes(value as SiteQualificationPositioning);
}
