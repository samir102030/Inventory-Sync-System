const pdfOpts = (filename: string) => ({
  margin: [8, 8, 8, 8],
  filename,
  image: { type: "jpeg", quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, logging: false },
  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
});

async function getLib(): Promise<any> {
  const mod = await import("html2pdf.js");
  return (mod as any).default ?? mod;
}

export async function downloadPDF(element: HTMLElement, filename: string) {
  const h = await getLib();
  await h().set(pdfOpts(filename)).from(element).save();
}

export async function sharePDF(element: HTMLElement, filename: string): Promise<boolean> {
  const h = await getLib();
  const blob: Blob = await new Promise((resolve, reject) => {
    h()
      .set(pdfOpts(filename))
      .from(element)
      .toPdf()
      .get("pdf")
      .then((pdf: any) => resolve(new Blob([pdf.output("arraybuffer")], { type: "application/pdf" })))
      .catch(reject);
  });
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return true;
  }
  return false;
}
