import { createContext, useContext } from 'react';
import type { CatalogCategory, SessionUser } from './api.js';

/* ══════════ 路由与导航（原型 navVals：10 组 22 路由） ══════════ */

export const NAV: Array<{ key: string; label: string; children: Array<[string, string]> }> = [
  { key: 'dash', label: '工作台', children: [] },
  {
    key: 'collect',
    label: '知识采集',
    children: [
      ['collect.extract', 'AI 抽取工作台'],
      ['collect.trash', '垃圾箱'],
    ],
  },
  {
    key: 'author',
    label: '知识编辑',
    children: [
      ['author.drafts', '我的草稿'],
      ['author.mine', '我提交的'],
      ['author.import', '一键导入'],
    ],
  },
  {
    key: 'review',
    label: '审核中心',
    children: [
      ['review.queue', '待我审核'],
      ['review.log', '审核记录'],
    ],
  },
  {
    key: 'kb',
    label: '知识库',
    children: [
      ['kb.list', '全部知识'],
      ['kb.offline', '已下线'],
    ],
  },
  {
    key: 'publish',
    label: '发布与同步',
    children: [
      ['publish.channels', 'Zendesk 同步'],
      ['publish.logs', '同步日志'],
    ],
  },
  {
    key: 'feedback',
    label: '反馈回流',
    children: [
      ['feedback.list', '用户反馈'],
      ['feedback.miss', '未命中问题'],
    ],
  },
  {
    key: 'meta',
    label: '元数据中心',
    children: [
      ['meta.tree', '知识分类'],
      ['meta.scenes', '问题场景'],
      ['meta.tags', '知识标签'],
    ],
  },
  { key: 'analytics', label: '数据分析', children: [['analytics.health', '知识健康度']] },
  {
    key: 'admin',
    label: '系统管理',
    children: [
      ['admin.users', '用户与角色'],
      ['admin.perms', '权限矩阵'],
      ['admin.audit', '操作审计'],
    ],
  },
];

/** 定制视图路由 → 视图名（其余走通用列表页） */
export const BESPOKE: Record<string, string> = {
  'collect.extract': 'extract',
  'author.editor': 'editor',
  'kb.detail': 'detail',
  'analytics.health': 'health',
  'review.detail': 'reviewPage',
};

export interface ToastNext {
  label: string;
  route: string;
  sel?: string;
}

export type DrawerState =
  | { kind: 'review'; code: string }
  /** 统一审核请求详情（分类 / 场景 / 回滚等非正文对象） */
  | { kind: 'reviewRequest'; code: string }
  | { kind: 'meta'; metaKind: '分类' | '场景' | '标签'; id: string | null; zh: string; en: string; parent: string; parentId: string; type: string }
  | { kind: 'miss'; code: string }
  | { kind: 'sources'; code: string }
  | {
      kind: 'info';
      title: string;
      meta: string;
      rows: Array<{ k: string; v: string }>;
      body?: string;
      /** 记录详情里的可执行动作（如权限矩阵「调整」） */
      action?: { label: string; run: () => Promise<void> };
    }
  | {
      kind: 'user';
      /** 有 id = 编辑既有账号；无 id = 新增 */
      id?: string;
      name?: string;
      email?: string;
      department?: string;
      role?: 'super' | 'ops';
      reviewGranted?: boolean;
    }
  | null;

export type ModalState =
  | { type: 'rollback'; code: string; version: string; adopt: number }
  | { type: 'offline'; code: string }
  | { type: 'switch' }
  | { type: 'mergeTag'; id: string; name: string }
  /** 采纳向导：确认分类 → 场景 → 正文 → 总览与提交 */
  | { type: 'adopt'; code: string }
  /** 分类 / 场景下架的二次确认：会如实列出对 Zendesk 的删除后果 */
  | { type: 'unpublishMeta'; kind: 'categories' | 'scenes'; id: string; name: string }
  | { type: 'batchDelete'; codes: string[] }
  | { type: 'batchShelf'; codes: string[]; action: 'offline' | 'restore' }
  | null;

/** 长操作的分步进度（拉取 / 抽取 / 发布同步 / 导入），逐步落在模态里 */
export interface ProgressStep {
  label: string;
  state: 'pending' | 'running' | 'done' | 'failed';
  detail?: string;
}

export interface ProgressState {
  title: string;
  steps: ProgressStep[];
  done: boolean;
  /**
   * 可中止的长操作（如一键导入）在此挂取消回调。
   * 模态的遮罩盖住整页，页面上的「取消上传」按钮根本点不到——
   * 取消入口必须在模态自己身上。
   */
  onCancel?: () => void;
}

export interface Ctx {
  user: SessionUser;
  catalog: CatalogCategory[];
  route: string;
  sel: string | null;
  go: (route: string, sel?: string | null) => void;
  toast: (title: string, detail: string, next?: ToastNext) => void;
  openDrawer: (d: DrawerState) => void;
  openModal: (m: ModalState) => void;
  /**
   * 跑一个带进度模态的长操作：steps 里的每一步依次点亮，失败即停并把原因显示出来。
   * 用于「从 Zendesk 拉取」「立即拉取抽取」「提交并发布」「一键导入」等会卡住界面的操作。
   */
  runWithProgress: <T>(
    title: string,
    steps: Array<{ label: string; run: (ctx: { setDetail: (d: string) => void }) => Promise<T | void> }>,
    /** 可中止的操作传它，模态里才会出现「取消」按钮 */
    onCancel?: () => void,
  ) => Promise<void>;
  refreshShell: () => void;
  /** 全局刷新计数：视图以它作为 useEffect 依赖来重新拉数据 */
  rev: number;
}

export const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('AppCtx 未挂载');
  return ctx;
}
