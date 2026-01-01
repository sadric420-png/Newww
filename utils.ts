
import * as XLSX from 'xlsx';

/**
 * Standardizes party names by removing extra whitespace and converting to lowercase.
 */
export const standardizeName = (name: any): string => {
  if (typeof name !== 'string') return String(name || '').toLowerCase().trim();
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
};

/**
 * Extracts Latitude and Longitude from an address string using Regex.
 * Matches patterns like "31.65 74.89" or "31.65, 74.89".
 */
export const extractCoordinates = (address: string): { lat: string; lng: string } => {
  const gpsRegex = /(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/;
  const match = address.match(gpsRegex);
  if (match) {
    return { lat: match[1], lng: match[2] };
  }
  return { lat: '', lng: '' };
};

/**
 * Parses an uploaded file (CSV or XLSX) into a JSON array.
 */
export const parseFile = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
};

/**
 * Generates and triggers download for an Excel file.
 */
export const downloadExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};
