import { z } from "zod";
import { contactSchema } from "@/lib/booking/validation";

/**
 * Contact-enquiry contract: the single schema the contact page posts and the
 * server validates. Reuses the client-side `contactSchema` so both sides agree
 * on what "a reachable guest with a real message" means.
 */
export const contactEnquiryContract = contactSchema;

export type ContactEnquiryInput = z.infer<typeof contactEnquiryContract>;
