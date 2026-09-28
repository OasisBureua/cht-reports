/**
 * Print the filled HTML report to a real PDF. Platform download checks
 * ContentType application/pdf and the %PDF file header; HTML (even under
 * a .pdf key) is rejected.
 */

export const PDF_PRINTER = Symbol('PDF_PRINTER');

export interface PdfPrinter {
  print(html: string): Promise<Buffer>;
}
