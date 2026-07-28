/** Default outreach profile copy — seed + fallback when DB fields are empty. */

export const DEFAULT_EMAIL_SUBJECT =
  "Quick thought on {{company_short}}";

export const DEFAULT_EMAIL_BODY = `Hi {{first_name}},

{{opening_hook}}

We work with a few UK dental marketing agencies as their white-label technical partner. When a client's requirements go beyond what the agency wants to build in-house, automation, integrations, on-premise voice AI, custom portals, or internal tools, we build and deliver everything under the agency's brand.

We're not another marketing platform or software vendor. Think of us as an engineering bench you can pull in whenever technical work lands on your desk.

If that's ever useful, happy to jump on a quick 15-minute call.

Best,
{{your_name}}
FusionSync`;

export const DEFAULT_LINKEDIN_CONNECTION =
  "Hi {{first_name}} — we partner with UK dental marketing agencies on white-label technical fulfilment when client work outpaces the team. Saw {{company_short}} — would be good to connect.";

export const DEFAULT_LINKEDIN_COMMENT =
  "{{post_topic}} — campaigns are one layer, but automation and booking sync is usually where dental clients feel the pain. Curious what you're seeing on your side.";

export const DEFAULT_REDDIT_COMMENT = `We see this a lot with dental agencies: marketing scales, then client asks drift into software (automation, integrations) and there's no clean way to fulfil without hiring devs.

What helped other shops was white-label fulfilment: agency keeps the relationship, a specialist team ships under their brand.

Happy to share what that looked like for a UK dental agency if it helps.`;

export const DEFAULT_ENRICHMENT_PROMPT = `Write personalizedHighlight as a cold email opener. One sentence. Sounds like something you'd say on a call. Pick one real thing from their website (case study result, book, client outcome). No research notes, no bios.

Examples:
GOOD: Tooth Doctor's move from diary gaps to a waiting list, with the full channel stack behind it rather than just the headline, is a solid proof point.
GOOD: Your Instagram for Dentists book is still the go-to reference for practices trying to actually get patients from social, not just post pretty photos.
BAD: Decision-maker context: Shaz Memon is founder/face of Digimax...
BAD: Saw your Tooth Doctor case study.
BAD: Industry roundups note no publicly confirmed integrations.`;

export const DEFAULT_SIGNER_NAME = "Shubham";
