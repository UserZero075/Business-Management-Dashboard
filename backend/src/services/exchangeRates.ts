import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const CURRENCY_META: Record<string, { name: string; symbol: string }> = {
  USD: { name: 'Dólar americano', symbol: '$' },
  EUR: { name: 'Euro', symbol: 'EUR' },
  MLC: { name: 'Moeda livremente conversível', symbol: 'MLC' },
  USDT: { name: 'Tether', symbol: 'USDT' },
};

function parseRate(value: string) {
  return Number(value.replace(/,/g, ''));
}

function extractRates(html: string) {
  const $ = cheerio.load(html);
  const rates: Record<string, number> = {};

  $('table, div, section, article').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ');

    const usdMatch = text.match(/1\s*USD\s*([\d,]+(?:\.\d+)?)\s*CUP/i);
    if (usdMatch) rates.USD = parseRate(usdMatch[1]);

    const eurMatch = text.match(/1\s*EUR\s*([\d,]+(?:\.\d+)?)\s*CUP/i);
    if (eurMatch) rates.EUR = parseRate(eurMatch[1]);

    const mlcMatch = text.match(/1\s*MLC\s*([\d,]+(?:\.\d+)?)\s*CUP/i);
    if (mlcMatch) rates.MLC = parseRate(mlcMatch[1]);

    const usdtMatch = text.match(/(?:1\s*)?USDT\s*([\d,]+(?:\.\d+)?)\s*CUP/i);
    if (usdtMatch && !rates.USDT) rates.USDT = parseRate(usdtMatch[1]);
  });

  return rates;
}

export async function fetchElToqueRates(prisma: PrismaClient) {
  const url = process.env.EL_TOQUE_URL || 'https://eltoque.com/tasas-de-cambio-de-moneda-en-cuba-hoy';
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao buscar dados no El Toque: ${response.status}`);
  }

  const rates = extractRates(await response.text());
  const savedAt = new Date();

  for (const [code, rate] of Object.entries(rates)) {
    if (!rate || Number.isNaN(rate)) continue;
    const meta = CURRENCY_META[code] || { name: code, symbol: code };
    const currency = await prisma.currency.upsert({
      where: { code },
      update: {},
      create: { code, name: meta.name, symbol: meta.symbol },
    });

    await prisma.exchangeRate.create({
      data: {
        currencyId: currency.id,
        rate,
        source: 'eltoque',
        date: savedAt,
      },
    });
  }

  return { rates, fetchedAt: savedAt.toISOString() };
}

export function scheduleElToqueRates(prisma: PrismaClient, logger: { info: (data: unknown, message?: string) => void; error: (data: unknown, message?: string) => void }) {
  const refresh = async () => {
    try {
      const result = await fetchElToqueRates(prisma);
      logger.info(result, 'Taxas de câmbio atualizadas pelo El Toque');
    } catch (error) {
      logger.error(error, 'Falha ao atualizar taxas de câmbio pelo El Toque');
    }
  };

  refresh();
  const interval = setInterval(refresh, 24 * 60 * 60 * 1000);
  interval.unref?.();
}
