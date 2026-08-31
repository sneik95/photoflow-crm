"use client";

import { strToU8, zipSync } from "fflate";
import type { Client, Shoot } from "./crm-data";

type Cell = string | number | boolean | null;

function xml(value: Cell) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function sheet(rows: Cell[][], widths: number[]) {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
          const style = rowIndex === 0 ? ' s="1"' : "";
          if (typeof value === "number") {
            return `<c r="${reference}"${style}><v>${value}</v></c>`;
          }
          return `<c r="${reference}" t="inlineStr"${style}><is><t>${xml(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const cols = widths
    .map(
      (width, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
    )
    .join("");
  const range = rows.length
    ? `A1:${columnName(Math.max(...rows.map((row) => row.length)) - 1)}${rows.length}`
    : "A1";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${range}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${body}</sheetData>
  <autoFilter ref="${range}"/>
</worksheet>`;
}

export function downloadCrmExcel(clients: Client[], shoots: Shoot[]) {
  const clientRows: Cell[][] = [
    ["ID", "Тип", "Имя / название", "Телефон", "E-mail", "Заметки"],
    ...clients.map((client) => [
      client.id,
      client.kind === "company" ? "Юрлицо" : "Физлицо",
      client.name,
      client.phone,
      client.email,
      client.notes,
    ]),
  ];
  const shootRows: Cell[][] = [
    [
      "ID",
      "Клиент",
      "Тип съёмки",
      "Начало",
      "Конец",
      "Весь день",
      "Комментарий",
      "Стоимость",
      "Тип оплаты",
      "Оплачено",
      "Остаток",
      "Дней на обработку",
      "Сдано",
      "Архив",
      "Статус",
      "Локация",
      "Дорога, мин.",
      "Организатор",
      "Телефон организатора",
      "Обработка, ч.",
      "Расходы на дорогу",
      "Прочие расходы",
      "Резервные копии",
      "Памятка клиенту",
    ],
    ...shoots.map((shoot) => [
      shoot.id,
      shoot.clientName,
      shoot.type,
      shoot.startAt.replace("T", " "),
      shoot.endAt.replace("T", " "),
      shoot.allDay ? "Да" : "Нет",
      shoot.comment,
      shoot.price,
      shoot.paymentType === "advance"
        ? "Аванс"
        : shoot.paymentType === "full"
          ? "Полная оплата"
          : "Постоплата",
      shoot.paidAmount,
      Math.max(0, shoot.price - shoot.paidAmount),
      shoot.deliveryDays,
      shoot.delivered ? "Да" : "Нет",
      shoot.archived ? "Да" : "Нет",
      shoot.status,
      shoot.location,
      shoot.travelMinutes,
      shoot.organizerName,
      shoot.organizerPhone,
      shoot.editingHours,
      shoot.travelCost,
      shoot.otherCosts,
      shoot.backupStatus === "two"
        ? "2 копии"
        : shoot.backupStatus === "one"
          ? "1 копия"
          : "Нет",
      shoot.clientGuide,
    ]),
  ];

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Клиенты" sheetId="1" r:id="rId1"/><sheet name="Съёмки" sheetId="2" r:id="rId2"/></sheets>
</workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF5D3A7D"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`),
    "xl/worksheets/sheet1.xml": strToU8(
      sheet(clientRows, [8, 14, 28, 20, 28, 42]),
    ),
    "xl/worksheets/sheet2.xml": strToU8(
      sheet(shootRows, [8, 25, 18, 20, 20, 12, 38, 15, 18, 15, 15, 20, 12, 12, 16, 32, 14, 24, 22, 16, 18, 18, 18, 45]),
    ),
  };

  const content = zipSync(files, { level: 6 });
  const url = URL.createObjectURL(
    new Blob([content.buffer as ArrayBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `PhotoFlow-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
