
export interface MasterRecord {
  'Party Name': string;
  'Number': string;
  'Address': string;
  'Latitude'?: string;
  'Longitude'?: string;
  'OriginalIndex'?: number;
}

export interface SalesRecord {
  'Party Name': string;
  'Phone No.': string;
}

export interface TemplateRecord {
  'Name': string;
  'Latitude': string;
  'Longitude': string;
  'Address': string;
  'Phone': string;
  'Group': string;
  'Notes': string;
}

export interface MissingParty {
  'Party Name': string;
  'Phone No.': string;
  'Address': string;
}

export type Step = 'UPLOAD' | 'FIX_MISSING' | 'MAPPING' | 'DOWNLOAD';
