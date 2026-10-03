const DEFAULT_BANKS = [
  "HDFC Bank",
  "ICICI Bank",
  "State Bank of India",
  "Axis Bank",
  "Kotak Mahindra Bank",
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "Punjab National Bank",
  "Yes Bank",
];

export async function listBanks(prisma) {
  if (!prisma?.bank?.findMany) {
    console.error("listBanks: prisma.bank is unavailable — restart the dev server after prisma generate");
    return [];
  }

  let banks = await prisma.bank.findMany({
    orderBy: { bankName: "asc" },
    select: { id: true, bankName: true },
  });

  if (!banks.length) {
    await Promise.all(
      DEFAULT_BANKS.map((bankName) =>
        prisma.bank.upsert({ where: { bankName }, update: {}, create: { bankName } })
      )
    );
    banks = await prisma.bank.findMany({
      orderBy: { bankName: "asc" },
      select: { id: true, bankName: true },
    });
  }

  return banks.map((b) => ({
    id: b.id,
    value: b.bankName,
    label: b.bankName,
    bankName: b.bankName,
  }));
}

export async function ensureBankExists(prisma, bankName) {
  const name = String(bankName || "").trim();
  if (!name || !prisma?.bank?.upsert) return null;
  return prisma.bank.upsert({
    where: { bankName: name },
    update: {},
    create: { bankName: name },
  });
}

export async function createBank(prisma, bankName) {
  const name = String(bankName || "").trim();
  if (!name) {
    return { ok: false, error: "Bank name is required." };
  }
  if (name.length > 100) {
    return { ok: false, error: "Bank name must be under 100 characters." };
  }
  if (!prisma?.bank?.create) {
    return { ok: false, error: "Banks API unavailable. Restart the server after prisma generate." };
  }
  try {
    const bank = await prisma.bank.create({ data: { bankName: name } });
    return {
      ok: true,
      bank: {
        id: bank.id,
        value: bank.bankName,
        label: bank.bankName,
        bankName: bank.bankName,
      },
    };
  } catch (err) {
    if (err?.code === "P2002") {
      const existing = await prisma.bank.findUnique({ where: { bankName: name } });
      return {
        ok: true,
        bank: existing
          ? {
              id: existing.id,
              value: existing.bankName,
              label: existing.bankName,
              bankName: existing.bankName,
            }
          : { value: name, label: name, bankName: name },
        alreadyExists: true,
      };
    }
    return { ok: false, error: err.message || "Failed to add bank." };
  }
}
