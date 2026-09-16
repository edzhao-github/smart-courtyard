import type { Metadata } from 'next';
import './globals.css';
import { WorkspaceGate } from '@/components/workspace-gate';
export const metadata: Metadata = {
  title: '园境 · 园区绘图工作台',
  description:
    '绘制园区结构、房间、大棚及露天区域，管理空间属性并导出园区平面图。',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body><WorkspaceGate>{children}</WorkspaceGate></body>
    </html>
  );
}
