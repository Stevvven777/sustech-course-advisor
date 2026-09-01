import ExcelJS from "exceljs";
import type { AdvisorResult, RecommendedPlan } from "../types.js";
import { courseColorArgb } from "./colors.js";

const LABELS = { "high-load": "高负载", "high-grading": "高给分", interest: "兴趣匹配" } as const;

export async function buildWorkbook(result: AdvisorResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "sustech-course-advisor";
  workbook.created = new Date(result.generatedAt);
  const summary = workbook.addWorksheet("三策略总览", { views: [{ state: "frozen", ySplit: 1 }] });
  summary.addRow(["策略", "排入学分", "培养方案已确认学分", "归属未确认学分", "课程数", "培养要求覆盖", "警告"]);
  result.strategies.forEach((plan) => summary.addRow([LABELS[plan.strategy], plan.totalCredits, plan.confirmedCredits, plan.unresolvedCredits, plan.sections.length, plan.requirementCoverage.join("；"), plan.warnings.join("；")]));
  styleHeader(summary, 7);
  summary.columns = [{width:16},{width:12},{width:18},{width:16},{width:12},{width:48},{width:48}];
  result.strategies.forEach((plan) => addPlanSheet(workbook, plan));
  const sources = workbook.addWorksheet("来源与说明");
  sources.addRow(["字段", "内容"]); styleHeader(sources, 2);
  sources.addRows([["学期",result.semester],["生成时间",result.generatedAt],["培养方案",result.sourceStatuses.curriculumPdf?.ok?"已确认官方 PDF":"不可用"],["NCES",result.sourceStatuses.nces?.message??"可用"],["归因规则","多人评价归属于完整教学团队；部分匹配不归因到个人。"]]);
  sources.columns = [{width:22},{width:90}];
  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
}

function addPlanSheet(workbook: ExcelJS.Workbook, plan: RecommendedPlan): void {
  const sheet = workbook.addWorksheet(LABELS[plan.strategy], { views: [{ state: "frozen", xSplit: 1, ySplit: 2 }] });
  sheet.mergeCells("A1:H1"); sheet.getCell("A1").value = `${LABELS[plan.strategy]} · ${plan.totalCredits} 学分`; sheet.getCell("A1").font={bold:true,size:16};
  sheet.addRow(["节次","周一","周二","周三","周四","周五","周六","周日"]); styleHeader(sheet,8,2);
  for(let period=1;period<=13;period++){
    const row=[String(period),...Array.from({length:7},(_,index)=>{
      const hits=plan.sections.filter(section=>section.schedule.some(slot=>slot.day===index+1&&slot.periodStart<=period&&slot.periodEnd>=period));
      return hits.map(section=>`${section.code} ${section.name}\n${section.teachers.join("、")}\n${section.schedule.find(slot=>slot.day===index+1&&slot.periodStart<=period&&slot.periodEnd>=period)?.room??""}`).join("\n");
    })]; sheet.addRow(row);
  }
  sheet.columns=[{width:9},...Array.from({length:7},()=>({width:21}))];
  for(let row=3;row<=15;row++){sheet.getRow(row).height=52;for(let col=2;col<=8;col++){const cell=sheet.getCell(row,col);cell.alignment={wrapText:true,vertical:"middle",horizontal:"center"};if(cell.value){const code=String(cell.value).split(" ")[0];cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:courseColorArgb(code)}};}}}
  const start=17; sheet.getCell(start,1).value="课程代码";sheet.getCell(start,2).value="课程";sheet.getCell(start,3).value="教学团队";sheet.getCell(start,4).value="学分";sheet.getCell(start,5).value="NCES 团队匹配";sheet.getCell(start,6).value="置信度";sheet.getCell(start,7).value="选择理由";styleHeader(sheet,7,start);
  plan.sections.forEach(section=>{const ev=plan.evidence[section.rwh];sheet.addRow([section.code,section.name,section.teachers.join("、"),section.credits,ev?.teamMatch??"none",ev?.confidence??0,(plan.reasons[section.rwh]??[]).join("；")]);});
}

function styleHeader(sheet: ExcelJS.Worksheet, columns: number, row=1):void{for(let col=1;col<=columns;col++){const cell=sheet.getCell(row,col);cell.font={bold:true,color:{argb:"FFFFFFFF"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"173F5F"}};cell.alignment={vertical:"middle",horizontal:"center",wrapText:true};}}
