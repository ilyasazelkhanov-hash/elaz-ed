export type CertificationStatus = 'saved' | 'in_progress' | 'completed' | 'received'
export interface CertificationCard {
 id:string;title:string;provider:string;topic:string;credential:'certificate'|'badge';credential_note:string;
 free_course:boolean|null;free_credential:boolean|null;availability:'reachable'|'restricted'|'unavailable'|'unverified';checked_at:string|null;
 status:CertificationStatus;touched:boolean;gift:boolean;available:boolean;
}
export interface CertificationCatalog {streak:number;required_streak:number;unlocked:boolean;items:CertificationCard[];total:number}
