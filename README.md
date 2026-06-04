# Afinitie — Wedding Website

A clean, elegant wedding website built with vanilla HTML, CSS, and JavaScript. Designed for AWS S3 static hosting with CloudFront.

---

## File Structure

```
Afinitie/
├── index.html          # Home / landing page
├── our-story.html      # Our story + timeline
├── schedule.html       # Day-of program & venue info
├── rsvp.html           # RSVP form
├── registry.html       # Registry & gift links
│
├── styles/
│   └── main.css        # All styles (CSS variables, layout, components)
│
├── js/
│   ├── main.js         # Nav scroll + mobile hamburger
│   └── rsvp.js         # RSVP form logic + submission handler
│
└── images/
    ├── gallery/        # Couple photos
    └── icons/          # Favicons / touch icons
```

---

## Content Placeholders

Search for `<!-- ... PLACEHOLDER -->` across all HTML files to find spots that need real content:

| Placeholder | Where |
|---|---|
| Wedding date | All pages — `hero__date`, footer |
| Names | `index.html` hero |
| Venue / location | `schedule.html`, footer |
| Story intro & timeline | `our-story.html` |
| Program times | `schedule.html` |
| RSVP deadline | `rsvp.html` |
| Registry URLs | `registry.html` |
| Venmo handle | `registry.html` |
| Maps link | `schedule.html` |

---

## RSVP Backend

`js/rsvp.js` currently logs submissions to the console. Two ready-to-use options are documented in the file:

- **Formspree** — paste in your form ID, no backend needed
- **AWS API Gateway + Lambda** — wire up to a Lambda function that writes to DynamoDB or sends an email via SES

---

## Deploying to AWS

### 1. Create an S3 Bucket

```bash
aws s3 mb s3://your-wedding-domain-com --region us-east-1
```

Enable static website hosting:

```bash
aws s3 website s3://your-wedding-domain-com \
  --index-document index.html \
  --error-document index.html
```

### 2. Upload Files

```bash
aws s3 sync . s3://your-wedding-domain-com \
  --exclude ".git/*" \
  --exclude "README.md" \
  --cache-control "max-age=86400"
```

### 3. Set Bucket Policy (public read)

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::your-wedding-domain-com/*"
  }]
}
```

### 4. CloudFront (recommended)

Create a CloudFront distribution pointing to the S3 bucket for HTTPS + CDN performance. Set the default root object to `index.html`.

### 5. Custom Domain (Route 53 + ACM)

1. Request a certificate in AWS Certificate Manager (ACM) for your domain
2. Add the domain as a CloudFront alternate name
3. Create an A record alias in Route 53 pointing to the CloudFront distribution

---

## Local Development

No build step needed. Just open `index.html` in a browser, or run a local server:

```bash
# Python
python3 -m http.server 8080

# Node (npx)
npx serve .
```

---

## Built With

- HTML5 / CSS3 / Vanilla JS
- [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) + [Jost](https://fonts.google.com/specimen/Jost) via Google Fonts
- AWS S3 + CloudFront for hosting
