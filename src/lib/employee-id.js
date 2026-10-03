/** VLJ employee ID: VLJ-{designationCode}-{sequence} */

const ID_PREFIX = "VLJ";

export function formatEmployeeId(designationCode, sequenceNumber, sequenceStart) {
  const padLen = Math.max(String(sequenceStart).length, 3);
  const seqStr = String(sequenceNumber).padStart(padLen, "0");
  return `${ID_PREFIX}-${String(designationCode).toUpperCase()}-${seqStr}`;
}

export function parseEmployeeIdSequence(employeeCode, designationCode) {
  if (!employeeCode || !designationCode) return null;
  const code = String(designationCode).toUpperCase();
  const prefix = `${ID_PREFIX}-${code}-`;
  if (!employeeCode.toUpperCase().startsWith(prefix)) return null;
  const num = parseInt(employeeCode.slice(prefix.length), 10);
  return Number.isNaN(num) ? null : num;
}

export function peekNextSequence(designation) {
  const released = normalizeReleased(designation.releasedSequences);
  if (released.length > 0) return released[0];
  if (designation.lastSequence === null || designation.lastSequence === undefined) {
    return designation.sequenceStart;
  }
  return designation.lastSequence + 1;
}

function normalizeReleased(value) {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [];
  return [...arr].map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
}

/**
 * Reserve and return the next employee code for a designation (updates DB).
 */
export async function assignEmployeeCode(prisma, designationId, { tx } = {}) {
  const run = async (db) => {
    const designation = await db.designation.findUnique({ where: { id: designationId } });
    if (!designation) throw new Error("Designation not found");

    const released = normalizeReleased(designation.releasedSequences);
    let nextSeq;

    if (released.length > 0) {
      nextSeq = released.shift();
      await db.designation.update({
        where: { id: designationId },
        data: { releasedSequences: released },
      });
    } else {
      nextSeq =
        designation.lastSequence === null || designation.lastSequence === undefined
          ? designation.sequenceStart
          : designation.lastSequence + 1;
      await db.designation.update({
        where: { id: designationId },
        data: { lastSequence: nextSeq },
      });
    }

    return formatEmployeeId(designation.designationCode, nextSeq, designation.sequenceStart);
  };

  if (tx) return run(tx);
  return prisma.$transaction(run);
}

/** Preview next code without reserving it. */
export async function previewNextEmployeeCode(prisma, designationId) {
  const designation = await prisma.designation.findUnique({ where: { id: designationId } });
  if (!designation) throw new Error("Designation not found");
  const seq = peekNextSequence(designation);
  return formatEmployeeId(designation.designationCode, seq, designation.sequenceStart);
}

/** Return a released sequence number back to the designation pool. */
export async function releaseEmployeeCode(prisma, employeeCode, designationId, { tx } = {}) {
  const db = tx || prisma;
  const designation = await db.designation.findUnique({ where: { id: designationId } });
  if (!designation) return;

  const seq = parseEmployeeIdSequence(employeeCode, designation.designationCode);
  if (seq === null) return;

  const released = normalizeReleased(designation.releasedSequences);
  if (!released.includes(seq)) {
    released.push(seq);
    released.sort((a, b) => a - b);
  }

  await db.designation.update({
    where: { id: designationId },
    data: { releasedSequences: released },
  });
}

export async function validateDesignationForDepartment(prisma, designationId, departmentId) {
  const designation = await prisma.designation.findUnique({ where: { id: designationId } });
  if (!designation) return { valid: false, message: "Designation not found" };
  if (designation.departmentId !== Number(departmentId)) {
    return { valid: false, message: "Designation does not belong to the selected department" };
  }
  return { valid: true, designation };
}
