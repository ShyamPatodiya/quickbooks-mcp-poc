import fs from "node:fs";

export interface StoredTokens {
  refreshToken?: string;
  realmId?: string;
}

export interface TokenStore {
  read(): StoredTokens;
  save(update: StoredTokens): void;
}

export class FileTokenStore implements TokenStore {
  constructor(private readonly filePath: string) {}

  read(): StoredTokens {
    if (!fs.existsSync(this.filePath)) {
      return {};
    }
    const content = fs.readFileSync(this.filePath, "utf8");
    return {
      refreshToken: readValue(content, "QUICKBOOKS_REFRESH_TOKEN"),
      realmId: readValue(content, "QUICKBOOKS_REALM_ID"),
    };
  }

  save(update: StoredTokens): void {
    const current = fs.existsSync(this.filePath) ? fs.readFileSync(this.filePath, "utf8") : "";
    let next = current;
    if (update.refreshToken) {
      next = upsert(next, "QUICKBOOKS_REFRESH_TOKEN", update.refreshToken);
    }
    if (update.realmId) {
      next = upsert(next, "QUICKBOOKS_REALM_ID", update.realmId);
    }
    const temporary = `${this.filePath}.tmp.${process.pid}`;
    fs.writeFileSync(temporary, next.endsWith("\n") || next.length === 0 ? next : `${next}\n`, {
      mode: 0o600,
    });
    fs.renameSync(temporary, this.filePath);
  }
}

function readValue(content: string, name: string): string | undefined {
  const line = content.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  const value = line?.slice(name.length + 1).trim();
  return value ? value : undefined;
}

function upsert(content: string, name: string, value: string): string {
  const lines = content.length === 0 ? [] : content.split(/\r?\n/);
  const assignment = `${name}=${value}`;
  const index = lines.findIndex((line) => line.startsWith(`${name}=`));
  if (index >= 0) {
    lines[index] = assignment;
  } else {
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.splice(lines.length - 1, 0, assignment);
    } else {
      lines.push(assignment);
    }
  }
  return lines.join("\n");
}
