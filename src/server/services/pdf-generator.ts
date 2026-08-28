import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import puppeteer from 'puppeteer';

const __dirname = typeof import.meta.url === 'string'
  ? dirname(fileURLToPath(import.meta.url))
  : dirname(__filename);
const templatePath = process.env.TEMPLATE_PATH || join(__dirname, '../../../templates/cv-template.html');

let browser: puppeteer.Browser | null = null;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  }
  return browser;
}

interface PdfData {
  name: string;
  contact: string;
  summary: string;
  content: string;
}

export async function generatePdf(data: PdfData): Promise<Buffer> {
  const template = readFileSync(templatePath, 'utf-8');

  const contactParts: string[] = [];
  if (data.contact) contactParts.push(data.contact);

  const htmlContent = await marked(data.content);

  let html = template
    .replace('{{name}}', escapeHtml(data.name || 'Your Name'))
    .replace('{{contact}}', escapeHtml(contactParts.join(' | ')))
    .replace('{{#summary}}', data.summary ? '' : '<!-- ')
    .replace('{{/summary}}', data.summary ? '' : ' -->')
    .replace('{{summary}}', escapeHtml(data.summary || ''));

  html = html.replace('{{content}}', htmlContent);

  const b = await getBrowser();
  const page = await b.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' },
    printBackground: true,
  });
  await page.close();

  return Buffer.from(pdf);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
