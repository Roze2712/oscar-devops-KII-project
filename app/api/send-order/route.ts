import { Resend } from "resend";
import { NextResponse } from "next/server";

/** Free-tier Resend: only this sender is allowed until a domain is verified. */
const RESEND_FROM_ADDRESS = "onboarding@resend.dev";
/** Inbox that receives every order notification (not the customer's form email). */
const ORDER_NOTIFICATION_INBOX = "rrozinsopkova@gmail.com";

/** Same copy as locales `delivery.standardNotice` (MK). */
const STANDARD_DELIVERY_NOTICE_MK =
  "Испораката се врши низ цела Македонија во рок од 2 до 5 работни дена.";

type CartLine = {
  lineId?: string;
  id?: number;
  name?: string;
  price?: string | null;
  image?: string | null;
}; 


function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** First image URL from cart line (plain URL or JSON array of URLs). */
function getFirstImageUrl(image: string | null | undefined): string | null {
  if (image == null) return null;
  const trimmed = String(image).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        const first = parsed.find(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        );
        return first ? first.trim() : null;
      }
    } catch {
      /* treat as plain string */
    }
  }
  return trimmed;
}

/**
 * Email clients need absolute https URLs. Uses request Origin for same-site paths
 * (e.g. /file.jpg → https://yourdomain.com/file.jpg).
 */
function toAbsoluteImageUrl(
  raw: string | null,
  requestOrigin: string,
): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (s.startsWith("data:") || s.startsWith("blob:")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return `https:${s}`;
  const origin = requestOrigin.replace(/\/$/, "");
  if (s.startsWith("/")) return `${origin}${s}`;
  return `${origin}/${s.replace(/^\//, "")}`;
}

function buildOrderEmailHtml(
  payload: {
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    city: string;
    phone: string;
    items: CartLine[];
    total: string | number;
  },
  requestOrigin: string,
): string {
  const imgSize = 56;

  const rows = payload.items.map((item) => {
    const name = escapeHtml(String(item.name ?? "—"));
    const price = escapeHtml(String(item.price ?? "—"));
    const absolute = toAbsoluteImageUrl(
      getFirstImageUrl(item.image),
      requestOrigin,
    );
    const imgCell =
      absolute && !absolute.startsWith("blob:")
        ? `<img src="${escapeHtml(absolute)}" alt="" width="${imgSize}" height="${imgSize}" style="display:block;width:${imgSize}px;height:${imgSize}px;max-width:${imgSize}px;object-fit:cover;border-radius:4px;border:1px solid #e5e5e5;vertical-align:middle" />`
        : `<span style="display:inline-block;width:${imgSize}px;height:${imgSize}px;line-height:${imgSize}px;text-align:center;color:#999;font-size:11px;border:1px dashed #ddd;border-radius:4px">—</span>`;

    return `<tr>
      <td style="padding:8px;border:1px solid #e5e5e5;vertical-align:middle;width:${imgSize + 16}px">${imgCell}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;vertical-align:middle">${name}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:right;vertical-align:middle">${price}</td>
    </tr>`;
  });

  const rawCustomerEmail = payload.email.trim();
  const customerEmailDisplay =
    rawCustomerEmail !== "" ? escapeHtml(rawCustomerEmail) : "—";
  const customerMailtoHref =
    rawCustomerEmail !== ""
      ? `mailto:${encodeURIComponent(rawCustomerEmail)}`
      : "#";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:system-ui,sans-serif;font-size:14px;color:#111;line-height:1.5">
  <h2 style="margin:0 0 16px">Нова нарачка — OSCAR</h2>
  <p style="margin:0 0 20px;padding:12px 14px;background:#f5f5f5;border-radius:6px;border:1px solid #e5e5e5">
    <strong style="display:block;margin-bottom:4px;color:#333">Email на нарачувачот (за контакт)</strong>
    <a href="${customerMailtoHref}" style="color:#111;word-break:break-all">${customerEmailDisplay}</a>
  </p>
  <table style="border-collapse:collapse;width:100%;max-width:560px;margin-bottom:24px">
    <tbody>
      <tr><td style="padding:6px 0;color:#666;width:140px">Име</td><td style="padding:6px 0">${escapeHtml(payload.firstName)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Презиме</td><td style="padding:6px 0">${escapeHtml(payload.lastName)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0">${escapeHtml(payload.email)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Телефон</td><td style="padding:6px 0">${escapeHtml(payload.phone)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Град</td><td style="padding:6px 0">${escapeHtml(payload.city)}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Адреса</td><td style="padding:6px 0">${escapeHtml(payload.address)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;font-weight:600">Вкупно</td><td style="padding:6px 0;font-weight:600">${escapeHtml(String(payload.total))}</td></tr>
    </tbody>
  </table>
  <p style="margin:0 0 8px;font-weight:600">Производи</p>
  <table style="border-collapse:collapse;width:100%;max-width:560px">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:8px;border:1px solid #e5e5e5;text-align:left">Слика</th>
        <th style="padding:8px;border:1px solid #e5e5e5;text-align:left">Производ</th>
        <th style="padding:8px;border:1px solid #e5e5e5;text-align:right">Цена</th>
      </tr>
    </thead>
    <tbody>${rows.join("")}</tbody>
  </table>
  <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#666;line-height:1.55;max-width:560px">
    ${escapeHtml(STANDARD_DELIVERY_NOTICE_MK)}
  </p>
</body>
</html>`;
}

const CUSTOMER_CONFIRMATION_SUBJECT = "Вашата нарачка од OSCAR d-t е примена";

function buildCustomerConfirmationHtml(firstName: string): string {
  const greeting = firstName
    ? `Здраво ${escapeHtml(firstName)},`
    : "Здраво,";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:32px 24px;font-family:system-ui,-apple-system,sans-serif;font-size:15px;color:#171717;line-height:1.65;background:#ffffff">
  <p style="margin:0 0 18px">${greeting}</p>
  <p style="margin:0 0 28px;color:#404040">Ви благодариме на нарачката.</p>
  <p style="margin:0;padding-top:20px;border-top:1px solid #e5e5e5;font-size:13px;color:#525252;line-height:1.55;max-width:520px">
    ${escapeHtml(STANDARD_DELIVERY_NOTICE_MK)}
  </p>
  <p style="margin:32px 0 0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#a3a3a3">OSCAR d-t</p>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: "RESEND_API_KEY is not configured." },
        { status: 500 },
      );
    }

    // Instantiated per-request (not at module load) so `next build`
    // can collect this route's page data without a real API key.
    const resend = new Resend(process.env.RESEND_API_KEY);

    const body = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      email?: string;
      address?: string;
      city?: string;
      phone?: string;
      items?: CartLine[];
      total?: string | number;
    };

    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim();
    const address = String(body.address ?? "").trim();
    const city = String(body.city ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const items = Array.isArray(body.items) ? body.items : [];
    const total = body.total ?? "—";

    const requestOrigin = new URL(request.url).origin;

    const from = `OSCAR <${RESEND_FROM_ADDRESS}>`;

    const { data, error } = await resend.emails.send({
      from,
      to: [ORDER_NOTIFICATION_INBOX],
      replyTo: email || undefined,
      subject: `Нова нарачка — ${firstName} ${lastName}`.trim() || "Нова нарачка",
      html: buildOrderEmailHtml(
        {
          firstName,
          lastName,
          email,
          address,
          city,
          phone,
          items,
          total,
        },
        requestOrigin,
      ),
    });

    if (error) {
      console.error("[send-order] Resend API error response:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 502 },
      );
    }

    if (email) {
      const { error: confirmError } = await resend.emails.send({
        from,
        to: [email],
        subject: CUSTOMER_CONFIRMATION_SUBJECT,
        html: buildCustomerConfirmationHtml(firstName),
      });
      if (confirmError) {
        console.error(
          "[send-order] Customer confirmation email failed:",
          confirmError,
        );
      }
    }

    return NextResponse.json({ success: true, id: data?.id ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}