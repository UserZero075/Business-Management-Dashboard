import net from 'node:net';
import tls from 'node:tls';

type MailOptions = {
  to: string;
  subject: string;
  text: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
  secure: boolean;
};

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT || (process.env.SMTP_SECURE === 'true' ? 465 : 587));
  return {
    host,
    port,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || `no-reply@${host}`,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
  };
}

function encodeHeader(value: string) {
  return /[^\x20-\x7e]/.test(value) ? `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=` : value;
}

function escapeAddress(address: string) {
  return address.replace(/[\r\n<>]/g, '');
}

async function smtpSend(config: SmtpConfig, mail: MailOptions) {
  let socket: net.Socket | tls.TLSSocket = config.secure
    ? tls.connect({ host: config.host, port: config.port, servername: config.host })
    : net.connect({ host: config.host, port: config.port });

  let buffer = '';

  const waitFor = (expected: number | number[]) => new Promise<string>((resolve, reject) => {
    const codes = Array.isArray(expected) ? expected : [expected];
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1];
      const code = Number(last?.slice(0, 3));
      if (last?.[3] !== '-' && codes.includes(code)) {
        const response = buffer;
        buffer = '';
        socket.off('data', onData);
        socket.off('error', onError);
        resolve(response);
      } else if (last?.[3] !== '-' && code >= 400) {
        socket.off('data', onData);
        socket.off('error', onError);
        reject(new Error(buffer.trim()));
      }
    };
    const onError = (error: Error) => {
      socket.off('data', onData);
      reject(error);
    };
    socket.on('data', onData);
    socket.once('error', onError);
  });

  const command = async (line: string, expected: number | number[] = 250) => {
    socket.write(`${line}\r\n`);
    return waitFor(expected);
  };

  const close = () => {
    try {
      socket.end();
    } catch {
      socket.destroy();
    }
  };

  try {
    await waitFor(220);
    await command(`EHLO ${process.env.SMTP_HELO || 'localhost'}`);

    if (!config.secure && process.env.SMTP_STARTTLS !== 'false') {
      await command('STARTTLS', 220);
      socket = tls.connect({ socket, servername: config.host });
      await new Promise<void>((resolve, reject) => {
        socket.once('secureConnect', resolve);
        socket.once('error', reject);
      });
      buffer = '';
      await command(`EHLO ${process.env.SMTP_HELO || 'localhost'}`);
    }

    if (config.user && config.pass) {
      const auth = Buffer.from(`\0${config.user}\0${config.pass}`).toString('base64');
      await command(`AUTH PLAIN ${auth}`, [235, 503]);
    }

    await command(`MAIL FROM:<${escapeAddress(config.from)}>`, 250);
    await command(`RCPT TO:<${escapeAddress(mail.to)}>`, [250, 251]);
    await command('DATA', 354);

    const body = [
      `From: ${escapeAddress(config.from)}`,
      `To: ${escapeAddress(mail.to)}`,
      `Subject: ${encodeHeader(mail.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      mail.text.replace(/^\./gm, '..'),
      '.',
    ].join('\r\n');

    socket.write(`${body}\r\n`);
    await waitFor(250);
    await command('QUIT', 221).catch(() => undefined);
  } finally {
    close();
  }
}

export async function sendMail(mail: MailOptions) {
  const config = getSmtpConfig();
  if (!config) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP é obrigatório em produção. Configure SMTP_HOST, SMTP_USER, SMTP_PASS e SMTP_FROM.');
    }

    console.log(`[email:dev] To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}`);
    return { sent: false, dev: true };
  }

  await smtpSend(config, mail);
  return { sent: true, dev: false };
}
