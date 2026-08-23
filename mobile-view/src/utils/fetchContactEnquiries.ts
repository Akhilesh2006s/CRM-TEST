import { apiService } from '../services/api';

export type ContactEnquiry = {
  _id: string;
  school_code?: string;
  school_name?: string;
  school_type?: string;
  zone?: string;
  town?: string;
  subject?: string;
  description?: string;
  contact_mobile?: string;
  contact_person?: string;
  enquiry_date?: string;
  status?: string;
  executive?: { _id?: string; name?: string; email?: string };
};

type LeadRecord = {
  _id: string;
  school_code?: string;
  school_name?: string;
  contact_person?: string;
  contact_mobile?: string;
  zone?: string;
  status?: string;
  location?: string;
  city?: string;
  remarks?: string;
  lead_type?: string;
  createdAt?: string;
  managed_by?: { _id?: string; name?: string; email?: string };
  assigned_by?: { _id?: string; name?: string; email?: string };
  createdBy?: { _id?: string; name?: string; email?: string };
  renewalSource?: { sourceSchoolCode?: string };
};

function mapLeadStatusToEnquiry(status?: string) {
  if (status === 'Closed') return 'Resolved';
  if (status === 'Processing') return 'In Progress';
  return 'Pending';
}

function mapLeadToContactEnquiry(lead: LeadRecord): ContactEnquiry {
  const executive = lead.managed_by || lead.assigned_by || lead.createdBy;
  const contactPerson = lead.contact_person || '';
  const remarks = (lead.remarks || '').trim();
  const descriptionParts: string[] = [];
  if (contactPerson) descriptionParts.push(`Contact: ${contactPerson}`);
  if (remarks) descriptionParts.push(remarks);

  return {
    _id: lead._id,
    school_code: lead.school_code || lead.renewalSource?.sourceSchoolCode || '',
    school_type: lead.lead_type === 'renewal' ? 'Existing' : 'New',
    school_name: lead.school_name,
    zone: lead.zone || '',
    executive: executive ? { _id: executive._id, name: executive.name, email: executive.email } : undefined,
    town: lead.location || lead.city || '',
    subject: 'School enquiry',
    description: descriptionParts.join('\n'),
    contact_person: contactPerson,
    contact_mobile: lead.contact_mobile || '',
    enquiry_date: lead.createdAt,
    status: mapLeadStatusToEnquiry(lead.status),
  };
}

function normalizeEnquiryList(data: unknown): ContactEnquiry[] {
  if (Array.isArray(data)) return data as ContactEnquiry[];
  if (data && typeof data === 'object' && Array.isArray((data as { data?: ContactEnquiry[] }).data)) {
    return (data as { data: ContactEnquiry[] }).data;
  }
  return [];
}

function extractLeadsFromResponse(response: unknown): LeadRecord[] {
  if (Array.isArray(response)) return response as LeadRecord[];
  if (response && typeof response === 'object' && Array.isArray((response as { data?: LeadRecord[] }).data)) {
    return (response as { data: LeadRecord[] }).data;
  }
  return [];
}

async function fetchAllLeads(): Promise<LeadRecord[]> {
  const response = await apiService.get<unknown>('/leads?limit=1000');
  let allData = extractLeadsFromResponse(response);

  const totalPages =
    response && typeof response === 'object' && 'pagination' in response
      ? Number((response as { pagination?: { totalPages?: number } }).pagination?.totalPages) || 1
      : 1;

  if (totalPages > 1) {
    for (let page = 2; page <= totalPages; page += 1) {
      const pageResponse = await apiService.get<unknown>(`/leads?limit=1000&page=${page}`);
      allData = allData.concat(extractLeadsFromResponse(pageResponse));
    }
  }

  return allData;
}

export async function fetchContactEnquiries(): Promise<ContactEnquiry[]> {
  try {
    const data = await apiService.get<unknown>('/contact-queries');
    const list = normalizeEnquiryList(data);
    if (list.length > 0) return list;
  } catch {
    // Fall through to leads
  }

  const leads = await fetchAllLeads();
  return leads.map(mapLeadToContactEnquiry);
}
