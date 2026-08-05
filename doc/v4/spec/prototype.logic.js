const CATALOG = [
  { zh: '机票 · 售后', en: 'Air Ticket · After-sales', scenes: [
    { zh: '改签退票', en: 'Rebooking & Refund' }, { zh: '退款处理', en: 'Refund Processing' } ] },
  { zh: '机票 · 出行前', en: 'Air Ticket · Pre-trip', scenes: [
    { zh: '值机登机', en: 'Check-in & Boarding' }, { zh: '行李服务', en: 'Baggage Service' }, { zh: '特殊旅客', en: 'Special Passengers' } ] },
  { zh: '机票 · 异常处理', en: 'Air Ticket · Irregularity', scenes: [
    { zh: '航班异常', en: 'Flight Irregularity' } ] },
  { zh: '会员 · 权益', en: 'Membership · Benefits', scenes: [
    { zh: '会员权益', en: 'Membership Benefits' } ] },
  { zh: '酒店 · 订单', en: 'Hotel · Orders', scenes: [
    { zh: '酒店订单', en: 'Hotel Order' } ] },
  { zh: '支付 · 财务', en: 'Payment · Billing', scenes: [
    { zh: '支付与发票', en: 'Payment & Invoice' } ] }
];
const catEn = zh => { const c = CATALOG.find(x => x.zh === zh); return c ? c.en : '—'; };
const sceneEn = zh => { for (const c of CATALOG) { const s = c.scenes.find(x => x.zh === zh); if (s) return s.en; } return '—'; };
const scenesOf = zh => { const c = CATALOG.find(x => x.zh === zh); return c ? c.scenes : []; };
const catOfScene = zh => { for (const c of CATALOG) if (c.scenes.some(s => s.zh === zh)) return c.zh; return CATALOG[0].zh; };
const ALL_SCENES = CATALOG.reduce((a, c) => a.concat(c.scenes), []);

const ST = {
  draft: { l: '草稿', c: 'tag-neutral', d: '草稿 · 编辑中，尚未提交审核' }, pending: { l: '待审核', c: 'tag-outline', d: '待审核 · 已提交，排队等待审核' },
  rejected: { l: '已驳回', c: 'tag-neutral', d: '已驳回 · 审核未通过，退回修改' }, published: { l: '已发布', c: 'tag-accent', d: '已发布 · 线上生效，已同步 Zendesk' },
  fixing: { l: '修复中', c: 'tag-accent-2', d: '修复中 · 正在根据反馈修订' }, offline: { l: '已下线', c: 'tag-neutral', d: '已下线 · 已撤回，不再对客展示' }
};
const TITLE_EN = {
  '国际机票改签手续费计算规则（2026 版）': 'International Ticket Rebooking Fee Rules (2026 Ed.)',
  '婴儿及儿童票行李额度说明': 'Baggage Allowance for Infant & Child Tickets',
  '超售航班自愿放弃座位的补偿标准': 'Compensation for Voluntarily Giving Up a Seat on Oversold Flights',
  '值机失败常见原因与自助排查路径': 'Common Check-in Failures and Self-service Troubleshooting',
  '里程兑换机票的退改规则': 'Change & Refund Rules for Award (Mileage) Tickets',
  '签证拒签后的机票退款流程': 'Ticket Refund Process After Visa Denial',
  '台风天气航班大面积延误的应答话术': 'Agent Script for Large-scale Typhoon Delays',
  '特殊旅客（孕妇 / 无成人陪伴儿童）承运条件': 'Carriage Conditions for Special Passengers (Pregnant / Unaccompanied Minor)',
  '支付失败但已扣款的处理时效': 'Handling Time for Failed Payment with Successful Charge',
  '电子发票开具与重开规则': 'E-invoice Issuance and Re-issuance Rules',
  '联程航班误机的保护性改签': 'Protective Rebooking for Missed Connecting Flights',
  '酒店预订取消政策（境内 / 境外差异）': 'Hotel Booking Cancellation Policy (Domestic / Overseas)'
};

class Component extends DCLogic {
  state = this.seed();

  seed() {
    const d = (id, titleZh, catZh, sceneZh, status, ver, owner, at, q, conf, sync, adopt, hits) =>
      ({ id, titleZh, cat: catZh, scene: sceneZh, status, ver, owner, at, q, conf, sync, adopt, hits, views: hits * 4 });
    const S = 'synced', F = 'failed', N = 'none';
    const docs = [
      d('KB-20418', '国际机票改签手续费计算规则（2026 版）', '机票 · 售后', '改签退票', 'published', 'v3.2', '林静', '08-04 14:22', 78, 0.96, F, 31, 2840),
      d('KB-20402', '婴儿及儿童票行李额度说明', '机票 · 出行前', '行李服务', 'published', 'v1.4', '周迟', '08-02 09:41', 88, 0.91, S, 82, 5120),
      d('KB-20517', '超售航班自愿放弃座位的补偿标准', '机票 · 异常处理', '航班异常', 'pending', 'v2.0', '苏见', '08-05 10:12', 76, 0.88, N, 0, 0),
      d('KB-20522', '值机失败常见原因与自助排查路径', '机票 · 出行前', '值机登机', 'draft', 'v0.3', '林静', '08-05 08:30', 61, 0.72, N, 0, 0),
      d('KB-20489', '里程兑换机票的退改规则', '会员 · 权益', '会员权益', 'rejected', 'v1.1', '周迟', '08-03 16:55', 54, 0.63, N, 0, 0),
      d('KB-20460', '签证拒签后的机票退款流程', '机票 · 售后', '改签退票', 'published', 'v2.6', '苏见', '07-29 11:08', 91, 0.93, S, 88, 3960),
      d('KB-20530', '台风天气航班大面积延误的应答话术', '机票 · 异常处理', '航班异常', 'fixing', 'v4.1', '陈默', '08-05 09:05', 68, 0.81, S, 44, 6210),
      d('KB-20301', '特殊旅客（孕妇 / 无成人陪伴儿童）承运条件', '机票 · 出行前', '特殊旅客', 'published', 'v5.0', '林静', '07-18 15:30', 96, 0.97, S, 94, 7180),
      d('KB-20544', '支付失败但已扣款的处理时效', '支付 · 财务', '支付与发票', 'pending', 'v1.0', '周迟', '08-05 11:40', 72, 0.85, N, 0, 0),
      d('KB-20255', '电子发票开具与重开规则', '支付 · 财务', '支付与发票', 'offline', 'v3.0', '苏见', '06-11 10:02', 43, 0.58, N, 51, 2010),
      d('KB-20536', '联程航班误机的保护性改签', '机票 · 异常处理', '航班异常', 'draft', 'v0.1', '陈默', '08-05 13:15', 58, 0.69, N, 0, 0),
      d('KB-20421', '酒店预订取消政策（境内 / 境外差异）', '酒店 · 订单', '酒店订单', 'published', 'v2.2', '林静', '07-26 14:00', 85, 0.9, S, 76, 3320)
    ];
    docs.forEach(x => {
      x.titleEn = TITLE_EN[x.titleZh] || '';
      x.tags = ['改签', '规则'];
      x.bodyZh = this.bodyOf(x);
      if (x.status === 'published' || x.status === 'offline' || x.status === 'fixing') { x.bodyEn = this.translateBody(x.bodyZh, x.cat); x.translated = true; }
      else { x.bodyEn = ''; x.translated = false; }
    });
    docs[0].tags = ['国际机票', '改签', '手续费'];
    docs[1].tags = ['婴儿票', '行李'];

    const versions = {
      'KB-20418': [
        { v: 'v3.2', at: '2026-08-04 14:22', by: '林静', act: '发布', note: '按 8 月新政更新阶梯费率，新增 24 小时内档位', adopt: 31, hits: 2840 },
        { v: 'v3.1', at: '2026-07-21 10:05', by: '苏见', act: '发布', note: '补充国际段联程特例说明', adopt: 60, hits: 5120 },
        { v: 'v3.0', at: '2026-06-30 17:40', by: '陈默', act: '回滚', note: '自 v2.8 回滚，v2.9 费率表存在错误', adopt: 55, hits: 4310 },
        { v: 'v2.8', at: '2026-06-12 09:20', by: '林静', act: '发布', note: '首次拆分国内 / 国际两套费率', adopt: 52, hits: 3980 },
        { v: 'v2.6', at: '2026-05-04 11:12', by: '周迟', act: '发布', note: '初版整理自客服工单 FAQ', adopt: 48, hits: 3210 }
      ]
    };

    const tasks = [
      { id: 'CT-3081', title: '近 7 日高频未命中问题聚类', src: 'Zendesk 客服会话', state: 'ready', owner: '林静', at: '08-05 07:00', n: 5 },
      { id: 'CT-3079', title: '8 月运价政策客诉聚类', src: 'Zendesk 客服会话', state: 'running', owner: '周迟', at: '08-05 09:20', n: 6 },
      { id: 'CT-3072', title: '改签退票追问 Top50', src: 'Zendesk 工单', state: 'done', owner: '苏见', at: '08-03 18:00', n: 24 },
      { id: 'CT-3068', title: '行李服务客诉抽取', src: 'Zendesk 客服会话', state: 'failed', owner: '陈默', at: '08-02 22:10', n: 0 }
    ];

    const baseCands = [
      { id: 'EX-01', title: '婴儿票能否单独改签', scene: '改签退票', tags: ['婴儿票', '改签'], conf: 0.93, answer: '婴儿票不可脱离成人票单独改签。成人票改签后，婴儿票将随成人票自动改期，差价按新航段婴儿票价重新计算。', dup: false },
      { id: 'EX-02', title: '值机失败提示「证件信息不符」如何处理', scene: '值机登机', tags: ['值机', '证件'], conf: 0.87, answer: '提示证件信息不符时，请核对订单证件号与实际出行证件是否一致。不一致需在起飞前 4 小时联系客服修改，修改成功后重新值机。', dup: false },
      { id: 'EX-03', title: '国际机票改签手续费怎么算', scene: '改签退票', tags: ['国际机票', '手续费'], conf: 0.79, answer: '国际机票改签手续费按票价档位与距起飞时间分段收取，具体比例见费率表。', dup: true, dupId: 'KB-20418', dupTitle: 'KB-20418 国际机票改签手续费计算规则', dupScore: '91%' },
      { id: 'EX-04', title: '延误多久可以申请赔偿', scene: '航班异常', tags: ['延误', '赔偿'], conf: 0.64, answer: '因承运人原因导致的延误达到 4 小时以上，可申请补偿；天气等不可抗力不在补偿范围内。', dup: false },
      { id: 'EX-05', title: '改签后原座位是否保留', scene: '改签退票', tags: ['改签', '选座'], conf: 0.55, answer: '改签会重新出票，原选座失效，需在新航班重新选座。', dup: false }
    ];

    const feedbacks = [
      { id: 'FB-9912', kb: 'KB-20530', type: '差评', text: '话术太长，客户等不及，坐席念不完', conv: 'ZD-88231', at: '08-05 11:20', state: 'open' },
      { id: 'FB-9908', kb: 'KB-20418', type: '信息有误', text: '手续费比例与 8 月新政策不一致', conv: 'ZD-88190', at: '08-05 09:48', state: 'open' },
      { id: 'FB-9901', kb: 'KB-20489', type: '无法解决', text: '里程票退票规则没写清楚，客户追问三次', conv: 'ZD-88044', at: '08-04 20:11', state: 'open' },
      { id: 'FB-9894', kb: 'KB-20255', type: '差评', text: '发票重开入口找不到', conv: 'ZD-87920', at: '08-04 15:02', state: 'closed' }
    ];

    const misses = [
      { id: 'MS-441', q: '婴儿票能不能单独改签', scene: '改签退票', n7: 63, rate: '0%', state: 'open', summary: '改签类 · 婴儿票与成人票联动规则缺失，用户高频追问能否单独改签，属「规则空白」型未命中。' },
      { id: 'MS-438', q: '值机失败提示证件信息不符', scene: '值机登机', n7: 41, rate: '12%', state: 'open', summary: '值机异常 · 证件信息校验失败的自助处理路径未覆盖，属「流程缺失」型未命中。' },
      { id: 'MS-433', q: '共享航班的行李额按哪家算', scene: '行李服务', n7: 28, rate: '31%', state: 'planned', summary: '行李规则 · 代码共享航班行李额归属承运方的判定说明不足，属「细节不全」型未命中。' },
      { id: 'MS-421', q: '里程能不能转给家人', scene: '会员权益', n7: 19, rate: '8%', state: 'open', summary: '会员权益 · 里程转赠规则缺失，涉及亲友账户绑定与限制，属「规则空白」型未命中。' }
    ];

    const audit = [
      { at: '08-05 11:40', who: '周迟', act: '提交审核', obj: 'KB-20544 支付失败但已扣款的处理时效' },
      { at: '08-05 10:12', who: '苏见', act: '提交审核', obj: 'KB-20517 超售航班自愿放弃座位的补偿标准' },
      { at: '08-05 09:48', who: '系统', act: 'Zendesk 拉取', obj: 'ZD-88190 → FB-9908' },
      { at: '08-04 14:22', who: '林静', act: '发布', obj: 'KB-20418 v3.2' },
      { at: '08-04 14:23', who: '系统', act: 'Zendesk 同步', obj: 'KB-20418 英文版本（失败）' },
      { at: '08-04 10:02', who: '苏见', act: '审核通过', obj: 'KB-20418 v3.2' }
    ];

    return {
      role: this.props.startRole || 'super', route: 'dash', open: 'dash',
      sel: null, tab: 'content', lang: 'zh', drawerId: null, modal: null, modalValue: '', toasts: [], tid: 0,
      loading: false, query: '', filterIdx: 0, metaState: {},
      docs, versions, tasks, baseCands, cands: baseCands.slice(), feedbacks, misses, audit,
      task: 'CT-3081', ed: null, comment: '', metaEdit: null, missSel: null
    };
  }

  bodyOf(d) {
    return '一、适用范围。本条款适用于 COOLFLY 平台出票的' + (d.cat || '机票') + '订单。\n\n二、处理规则。旅客可在起飞前通过 App、官网或客服热线提交申请；系统将根据舱位等级、距起飞时间与航司政策自动计算结果，并在提交后 30 分钟内反馈。\n\n三、特殊情形。因航司原因导致的变更不收取任何费用；不可抗力情形按航司公告执行，坐席须引用当次公告编号。\n\n四、常见追问。若旅客对计算结果有异议，应引导其在订单详情页查看费用明细，必要时转人工复核，复核时限为 1 个工作日。';
  }
  translateBody(zh, cat) {
    return 'I. Scope. These terms apply to ' + catEn(cat) + ' orders ticketed on the COOLFLY platform.\n\nII. Handling. Passengers may submit a request before departure via the App, website or service hotline; the system calculates the outcome based on cabin class, time to departure and airline policy, and responds within 30 minutes.\n\nIII. Special cases. Changes caused by the carrier incur no fee; force-majeure cases follow the airline announcement, and agents must cite the announcement number.\n\nIV. Follow-ups. If the passenger disputes the result, guide them to the fee breakdown on the order page and escalate to manual review when necessary (SLA: 1 business day).';
  }
  translateTitle(zh) { return TITLE_EN[zh] || ('[MT] ' + zh); }

  go(route, sel) {
    const top = route.split('.')[0];
    this.setState({ loading: true, query: '', filterIdx: 0 });
    clearTimeout(this._t);
    this._t = setTimeout(() => this.setState({ loading: false }), 380);
    this.setState(s => ({ route, open: top, sel: sel === undefined ? s.sel : sel, tab: 'content', lang: 'zh' }));
  }
  toast(title, detail, next) {
    const id = ++this.state.tid;
    this.setState(s => ({ tid: id, toasts: [...s.toasts, { id, title, detail, next }] }));
    setTimeout(() => this.setState(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 9000);
  }
  log(who, act, obj) {
    const at = '08-05 ' + new Date().toTimeString().slice(0, 5);
    this.setState(s => ({ audit: [{ at, who, act, obj }, ...s.audit] }));
  }
  patch(id, fn) { this.setState(s => ({ docs: s.docs.map(x => x.id === id ? Object.assign({}, x, fn(x)) : x) })); }
  addVersion(id, v, act, note, by, adopt, hits) {
    this.setState(s => {
      const list = (s.versions[id] || []).slice();
      list.unshift({ v, at: '2026-08-05 ' + new Date().toTimeString().slice(0, 5), by, act, note, adopt: adopt || 0, hits: hits || 0 });
      return { versions: Object.assign({}, s.versions, { [id]: list }) };
    });
  }
  doc(id) { return this.state.docs.find(x => x.id === (id || this.state.sel)); }
  bump(v, big) { const m = /v(\d+)\.(\d+)/.exec(v) || [0, 1, 0]; return big ? 'v' + (+m[1] + 1) + '.0' : 'v' + m[1] + '.' + (+m[2] + 1); }
  me() {
    return this.state.role === 'super'
      ? { name: '陈默', roleLabel: '超级管理员', role: 'super' }
      : { name: '林静', roleLabel: '知识运营', role: 'ops' };
  }

  submitReview(id) {
    const d = this.doc(id);
    if (!d.scene || !d.translated) { this.go('author.editor', id); this.setState({ ed: this.loadEd(d), edErr: true }); this.toast('无法直接提交', '缺少问题场景或英文版本，已为你打开编辑器。', null); return; }
    this.patch(id, () => ({ status: 'pending', at: '08-05 ' + new Date().toTimeString().slice(0, 5) }));
    this.log(this.me().name, '提交审核', d.id + ' ' + d.titleZh);
    this.toast('已提交审核', d.id + ' 进入待审队列，审核人 苏见。通过后写入 Zendesk（英文版本）。', { l: '前往审核中心', r: 'review.queue' });
  }
  approve(id) {
    const d = this.doc(id);
    if (d.pendingKind === 'rollback') { this.applyRollback(id); return; }
    const nv = this.bump(d.ver, true);
    this.patch(id, () => ({ status: 'published', ver: nv, sync: 'pending', adopt: 0, hits: 0 }));
    this.addVersion(id, nv, '发布', this.state.comment || '审核通过，直接发布', this.me().name, 0, 0);
    this.log(this.me().name, '审核通过并发布', d.id + ' ' + nv);
    this.setState({ drawerId: null, comment: '' });
    setTimeout(() => { this.patch(id, () => ({ sync: 'synced' })); this.log('系统', 'Zendesk 同步', d.id + ' 英文版本（成功）'); }, 1600);
    this.toast('已发布，正在同步 Zendesk', d.id + ' ' + nv + ' 已发布，英文版本写入 Zendesk 中。', { l: '查看渠道同步', r: 'publish.channels' });
  }
  reject(id) {
    if (!this.state.comment.trim()) { this.toast('请填写驳回意见', '驳回必须说明原因，意见会回写到提交人的草稿。', null); return; }
    const d = this.doc(id);
    this.patch(id, () => ({ status: 'rejected', reject: this.state.comment }));
    this.log(this.me().name, '驳回', d.id + '：' + this.state.comment);
    this.setState({ drawerId: null, comment: '' });
    this.toast('已驳回', d.id + ' 已退回提交人草稿箱，附审核意见。', { l: '查看审核记录', r: 'review.log' });
  }
  goFix(fb) {
    const d = this.doc(fb.kb);
    if (!d) { this.toast('未找到关联知识', fb.kb + ' 不存在或已删除。', null); return; }
    const nv = d.status === 'published' ? this.bump(d.ver) : d.ver;
    this.patch(fb.kb, () => ({ status: 'draft', ver: nv }));
    this.setState(s => ({ feedbacks: s.feedbacks.map(f => f.id === fb.id ? Object.assign({}, f, { state: 'fixing' }) : f) }));
    this.log(this.me().name, '反馈转修复', fb.id + ' → ' + fb.kb + ' ' + nv);
    this.go('author.editor', fb.kb);
    this.setState({ ed: this.loadEd(Object.assign({}, d, { ver: nv, note: '修复反馈 ' + fb.id + '：' + fb.text })) });
    this.toast('已进入修复', fb.kb + ' ' + nv + ' 草稿已生成（线上仍为上一版本）。修改并翻译后重新提交审核。', null);
  }
  startRevision(id) {
    const d = this.doc(id);
    const nv = this.bump(d.ver);
    this.patch(id, () => ({ status: 'draft', ver: nv }));
    this.log(this.me().name, '创建修订版本', id + ' ' + nv);
    this.go('author.editor', id);
    this.setState({ ed: this.loadEd(Object.assign({}, d, { ver: nv })) });
    this.toast('修订草稿已创建', id + ' ' + nv + '，线上仍为上一版本。', null);
  }
  rollbackSubmit(id, v) {
    this.patch(id, () => ({ status: 'pending', pendingKind: 'rollback', pendingVer: v, at: '08-05 ' + new Date().toTimeString().slice(0, 5) }));
    this.log(this.me().name, '提交回滚审核', id + ' → ' + v);
    this.setState({ modal: null });
    this.toast('回滚已提交审核', id + ' 回滚至 ' + v + ' 已进入待审队列，审核通过后才生效。', { l: '前往审核中心', r: 'review.queue' });
  }
  applyRollback(id) {
    const d = this.doc(id), v = d.pendingVer;
    const vd = (this.state.versions[id] || []).find(x => x.v === v) || {};
    this.patch(id, () => ({ status: 'published', ver: v, sync: 'pending', adopt: vd.adopt || 0, hits: vd.hits || 0, pendingKind: null, pendingVer: null }));
    this.addVersion(id, v, '回滚', (this.state.comment || '审核通过，回滚至 ' + v) + '（历史采纳率 ' + (vd.adopt || 0) + '%）', this.me().name, vd.adopt, vd.hits);
    this.log(this.me().name, '审核通过 · 回滚生效', id + ' → ' + v);
    this.setState({ drawerId: null, comment: '' });
    setTimeout(() => { this.patch(id, () => ({ sync: 'synced' })); this.log('系统', 'Zendesk 同步', id + ' 英文版本重新下发'); }, 1500);
    this.toast('回滚已生效', id + ' 当前版本为 ' + v + '，英文版本重新写入 Zendesk。', { l: '查看同步日志', r: 'publish.logs' });
  }
  sync(id) {
    this.patch(id, () => ({ sync: 'pending' }));
    setTimeout(() => { this.patch(id, () => ({ sync: 'synced' })); this.log('系统', 'Zendesk 同步', id + ' 英文版本（成功）'); }, 1200);
    this.toast('同步已触发', id + ' 英文版本正在写入 Zendesk。', null);
  }
  pullZendesk() {
    const conv = 'ZD-8' + (8240 + this.state.feedbacks.length);
    const fb = { id: 'FB-99' + (13 + this.state.feedbacks.length), kb: 'KB-20402', type: '无法解决', text: '共享航班行李额到底按哪家算，客服也说不清', conv, at: '08-05 ' + new Date().toTimeString().slice(0, 5), state: 'open' };
    this.setState(s => ({ feedbacks: [fb, ...s.feedbacks] }));
    this.log('系统', 'Zendesk 拉取', conv + ' → ' + fb.id);
    this.toast('已从 Zendesk 拉取 1 条客诉', fb.id + '（会话 ' + conv + '）已进入反馈回流，可直接在列表修复。', { l: '前往反馈回流', r: 'feedback.list' });
  }
  acceptCand(c) {
    const nid = 'KB-2' + (600 + this.state.docs.length);
    const scene = c.scene, cat = catOfScene(scene);
    const nd = { id: nid, titleZh: c.title, titleEn: '', scene, cat, status: 'draft', ver: 'v0.1', owner: this.me().name, at: '08-05 ' + new Date().toTimeString().slice(0, 5), q: 60, conf: c.conf, sync: 'none', adopt: 0, hits: 0, views: 0, bodyZh: c.answer, bodyEn: '', translated: false, tags: c.tags.slice(), src: 'AI 抽取 · ' + this.state.task + ' / ' + c.id };
    this.setState(s => ({ docs: [nd, ...s.docs], cands: s.cands.filter(x => x.id !== c.id) }));
    this.log(this.me().name, 'AI 抽取生成草稿', nid + ' ' + c.title);
    this.toast('已生成草稿', nid + ' 已建，来源 ' + this.state.task + '。补全正文并翻译为英文后即可提交审核。', { l: '编辑该草稿', r: 'author.editor', id: nid });
  }
  loadEd(d) {
    return { id: d.id, title: d.titleZh, titleEn: d.titleEn || '', bodyZh: d.bodyZh || this.bodyOf(d), bodyEn: d.bodyEn || '', scene: d.scene, cat: d.cat, tags: (d.tags || []).slice(), note: d.note || '', ver: d.ver, status: d.status, translated: !!d.translated, enEdited: false, transN: 0, ai: this.props.showAiAssist === false ? [] : [0, 1] };
  }
  htmlOf(text) { if (/[<][a-z]/i.test(text)) return text; return text.split('\n\n').map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>').join(''); }

  renderVals() {
    const s = this.state, me = this.me(), P = this.props;
    const A = 'var(--color-accent)', T = 'var(--color-text)', M = 'var(--color-neutral-600)';
    const nav = this.navVals();
    const denied = s.route.indexOf('admin') === 0 && s.role !== 'super';
    const view = this.viewFlags(denied);

    const searchHits = s.query
      ? s.docs.filter(x => x.titleZh.indexOf(s.query) >= 0 || x.id.indexOf(s.query.toUpperCase()) >= 0 || (x.scene || '').indexOf(s.query) >= 0 || (x.cat || '').indexOf(s.query) >= 0)
        .slice(0, 6).map(x => ({ title: x.titleZh, meta: x.id + ' · ' + (x.scene || '未设置场景') + ' · ' + ST[x.status].l, on: () => { this.setState({ query: '' }); this.go('kb.detail', x.id); } }))
      : [];

    const pend = s.docs.filter(x => x.status === 'pending');
    const drafts = s.docs.filter(x => x.status === 'draft' || x.status === 'rejected');
    const openFb = s.feedbacks.filter(f => f.state === 'open');
    const missOpen = s.misses.filter(m => m.state === 'open');
    const syncFail = s.docs.filter(x => x.sync === 'failed');

    return Object.assign({
      sideNav: P.navMode !== 'topmodule', topNav: P.navMode === 'topmodule',
      dz: P.density === 'compact' ? { rp: '5px', mp: '16px', fs: '13px' } : { rp: '11px', mp: '26px', fs: '14px' },
      subNav: (nav.find(g => g.open) || nav.find(g => g.col === 'var(--color-accent)') || { children: [] }).children,
      nav, me, view, searchHits, query: s.query,
      hasQuery: !!s.query, noHits: !!s.query && searchHits.length === 0,
      today: '2026 年 8 月 5 日 星期三',
      greeting: me.role === 'super' ? '早上好，陈默' : '早上好，林静',
      skeleton: [1, 2, 3, 4, 5, 6, 7],
      toasts: s.toasts.map(t => ({
        title: t.title, detail: t.detail, nextLabel: t.next ? t.next.l : null,
        close: () => this.setState(x => ({ toasts: x.toasts.filter(y => y.id !== t.id) })),
        next: () => { this.setState(x => ({ toasts: x.toasts.filter(y => y.id !== t.id) })); if (t.next) this.go(t.next.r, t.next.id); }
      })),
      stat: { total: s.docs.length + 1230, pubToday: 3, todo: pend.length + openFb.length + missOpen.length },
      onQuery: e => this.setState({ query: e.target.value }),
      switchRole: () => { this.setState(x => ({ role: x.role === 'super' ? 'ops' : 'super' })); this.toast('已切换角色', '当前角色为' + (s.role === 'super' ? '「知识运营」，系统管理模块将不可见' : '「超级管理员」，可见全部模块') + '。', null); },
      goHome: () => this.go('dash'), goTodo: () => this.go(pend.length ? 'review.queue' : 'feedback.list'),
      goCollect: () => this.go('collect.extract'), goFeedback: () => this.go('feedback.list'), goPull: () => this.pullZendesk(),
      newDraft: () => { const nid = 'KB-2' + (600 + s.docs.length); const nd = { id: nid, titleZh: '未命名知识', titleEn: '', scene: '', cat: CATALOG[0].zh, status: 'draft', ver: 'v0.1', owner: me.name, at: '08-05 现在', q: 20, conf: 0, sync: 'none', adopt: 0, hits: 0, views: 0, bodyZh: '', bodyEn: '', translated: false, tags: [] }; this.setState(x => ({ docs: [nd, ...x.docs] })); this.go('author.editor', nid); this.setState({ ed: this.loadEd(nd) }); },
      kpis: [
        { label: '待我审核', value: pend.length, delta: '较昨日 +1' },
        { label: '我的草稿', value: drafts.length, delta: '含 1 条被驳回' },
        { label: '待处理反馈', value: openFb.length, delta: '来自 Zendesk 客诉' },
        { label: 'Zendesk 同步失败', value: syncFail.length, delta: syncFail.length ? '需补英文字段' : '全部正常' },
        { label: '未命中问题', value: missOpen.length, delta: '可建采集任务' }
      ],
      todos: this.todoVals(pend, drafts, openFb),
      noTodos: pend.length + drafts.length + openFb.length === 0,
      lifecycle: [
        ['采集', 'collect.extract', s.cands.length], ['草稿', 'author.drafts', drafts.length],
        ['待审', 'review.queue', pend.length], ['已发布', 'kb.list', s.docs.filter(x => x.status === 'published').length],
        ['同步', 'publish.channels', s.docs.filter(x => x.sync === 'synced').length], ['反馈', 'feedback.list', s.feedbacks.length]
      ].map(x => ({ label: x[0], n: x[2], on: () => this.go(x[1]), col: x[2] > 0 ? A : M })),
      zendesk: [
        { k: '实例', v: 'coolfly.zendesk.com', col: T }, { k: '上次拉取', v: '08-05 11:40', col: T },
        { k: '待同步知识', v: s.docs.filter(x => x.sync === 'pending').length, col: T }, { k: '同步失败', v: syncFail.length, col: syncFail.length ? A : M }
      ],
      recentAudit: s.audit.slice(0, 6),
      catOpts: CATALOG
    },
      this.pageVals(), this.exVals(), this.edVals(), this.dtVals(), this.rvVals(), this.hlVals(),
      this.drawerVals(), this.modalVals());
  }

  navVals() {
    const s = this.state, A = 'var(--color-accent)', T = 'var(--color-text)', M = 'var(--color-neutral-600)';
    const groups = [
      ['dash', '工作台', []],
      ['collect', '知识采集', [['collect.extract', 'AI 抽取工作台']]],
      ['author', '知识编辑', [['author.drafts', '我的草稿'], ['author.mine', '我提交的']]],
      ['review', '审核中心', [['review.queue', '待我审核'], ['review.log', '审核记录']]],
      ['kb', '知识库', [['kb.list', '全部知识'], ['kb.offline', '已下线']]],
      ['publish', '发布与同步', [['publish.channels', 'Zendesk 同步'], ['publish.logs', '同步日志']]],
      ['feedback', '反馈回流', [['feedback.list', '用户反馈'], ['feedback.miss', '未命中问题']]],
      ['meta', '元数据中心', [['meta.tree', '知识分类'], ['meta.scenes', '问题场景'], ['meta.tags', '知识标签']]],
      ['analytics', '数据分析', [['analytics.health', '知识健康度']]],
      ['admin', '系统管理', [['admin.users', '用户与角色'], ['admin.perms', '权限矩阵'], ['admin.audit', '操作审计']]]
    ];
    const badges = { review: this.state.docs.filter(x => x.status === 'pending').length, feedback: this.state.feedbacks.filter(f => f.state === 'open').length };
    return groups.map((g, i) => {
      const act = s.open === g[0];
      return {
        label: g[1], num: String(i + 1).padStart(2, '0'), open: act && g[2].length > 0,
        col: act ? A : T, bar: act ? A : 'transparent', badge: badges[g[0]] || null,
        on: () => this.go(g[2].length ? g[2][0][0] : g[0]),
        children: g[2].map(c => ({
          label: c[1], on: () => this.go(c[0]),
          col: s.route === c[0] || (c[0] === 'kb.list' && s.route === 'kb.detail') || (c[0] === 'author.drafts' && s.route === 'author.editor') ? A : M,
          bar: s.route === c[0] ? A : 'var(--color-divider)', badge: null
        }))
      };
    });
  }

  viewFlags(denied) {
    const r = this.state.route, L = this.state.loading;
    const bespoke = { 'collect.extract': 'extract', 'author.editor': 'editor', 'kb.detail': 'detail', 'analytics.health': 'health', 'review.detail': 'reviewPage' };
    const b = bespoke[r];
    return {
      denied, loading: !denied && L,
      dash: !denied && !L && r === 'dash',
      list: !denied && !L && r !== 'dash' && !b,
      extract: !denied && !L && b === 'extract', editor: !denied && !L && b === 'editor',
      detail: !denied && !L && b === 'detail', health: !denied && !L && b === 'health',
      reviewPage: !denied && !L && b === 'reviewPage'
    };
  }

  todoVals(pend, drafts, openFb) {
    const A = 'var(--color-accent)', M = 'var(--color-neutral-600)', out = [];
    pend.slice(0, 2).forEach(d => out.push({ step: '审核', stepCol: A, title: d.titleZh, meta: d.id + ' · ' + d.owner + ' 提交 · ' + d.at, tagCls: 'tag-outline', tagText: '待审核', cta: '审核', on: () => this.openReview(d.id) }));
    openFb.slice(0, 2).forEach(f => out.push({ step: '反馈', stepCol: A, title: f.text, meta: f.id + ' · ' + f.kb + ' · Zendesk ' + f.conv + ' · ' + f.at, tagCls: 'tag-neutral', tagText: f.type, cta: '去修复', on: () => this.goFix(f) }));
    drafts.filter(d => d.status === 'rejected').slice(0, 1).forEach(d => out.push({ step: '草稿', stepCol: M, title: d.titleZh, meta: d.id + ' · 被驳回：' + (d.reject || '内容与新政策不一致'), tagCls: 'tag-neutral', tagText: '已驳回', cta: '修改', on: () => { this.go('author.editor', d.id); this.setState({ ed: this.loadEd(d) }); } }));
    return out;
  }
  openReview(id) {
    if (this.props.reviewMode === 'fullpage') this.go('review.detail', id);
    else this.setState({ drawerId: id, sel: id, comment: '' });
  }

  pageVals() {
    const s = this.state, r = s.route;
    const cfg = this.listCfg(r);
    if (!cfg) return { page: { rows: [], filters: [], actions: [] } };
    const rawFilters = (cfg.filters && cfg.filters.length) ? cfg.filters : [{ l: '全部' }];
    const idx = Math.min(s.filterIdx || 0, rawFilters.length - 1);
    const active = rawFilters[idx];
    let rows = cfg.rows || [];
    if (active && active.test) rows = rows.filter(active.test);
    const merged = Object.assign({}, cfg);
    merged.rows = rows;
    merged.count = rows.length + ' 条记录';
    merged.empty = rows.length === 0;
    merged.emptyTitle = cfg.emptyTitle || (idx > 0 ? '该筛选下暂无记录' : '暂无数据');
    merged.emptyDesc = idx > 0 ? '切换筛选或清除条件可查看更多记录。' : (cfg.emptyDesc || '当前筛选条件下没有记录。');
    merged.emptyCta = idx > 0 ? '查看全部' : (cfg.emptyCta || '返回工作台');
    merged.emptyOn = idx > 0 ? (() => this.setState({ filterIdx: 0 })) : (cfg.emptyOn || (() => this.go('dash')));
    merged.actions = cfg.actions || [];
    merged.h5 = cfg.h5 || '';
    merged.filters = rawFilters.map((f, i) => ({ l: f.l, on: i === idx, pick: () => this.setState({ filterIdx: i }) }));
    return { page: merged };
  }

  listCfg(r) {
    const s = this.state;
    const plain = obj => Object.assign({ c3plain: true, c3on: false }, obj);
    const D = d => plain({ id: d.id, c1: d.titleZh, sub: d.id + ' · ' + d.cat, c2: d.scene || '未设置', c3: ST[d.status].l, tagCls: ST[d.status].c, c4: d.at, c5: d.q, open: () => this.go('kb.detail', d.id) });
    const mk = (kicker, title, desc, hs, rows, extra) => Object.assign({ kicker, title, desc, h1: hs[0], h2: hs[1], h3: hs[2], h4: hs[3], h5: hs[4], rows }, extra || {});

    if (r === 'author.drafts' || r === 'author.mine') {
      const list = r === 'author.drafts' ? s.docs.filter(d => d.status === 'draft' || d.status === 'rejected') : s.docs.filter(d => d.status === 'pending' || d.status === 'published');
      return mk('知识编辑', r === 'author.drafts' ? '我的草稿' : '我提交的', r === 'author.drafts' ? '草稿需补全问题场景、翻译英文后才能提交审核。被驳回的知识会带着审核意见回到这里。' : '已提交的知识按审核进度排列，可查看审核意见与发布结果。',
        ['标题', '场景', '状态', '更新时间', '完整度'],
        list.map(d => Object.assign(D(d), {
          acts: r === 'author.drafts'
            ? [{ l: '编辑', on: () => { this.go('author.editor', d.id); this.setState({ ed: this.loadEd(d) }); } }, { l: '提交审核', on: () => this.submitReview(d.id) }]
            : [{ l: '查看', on: () => this.go('kb.detail', d.id) }]
        })),
        { actions: [{ l: '撰写新知识', cls: 'btn-primary', on: () => this.go('collect.extract') }], filters: r === 'author.drafts' ? [{ l: '全部' }, { l: '草稿', test: x => x.c3 === '草稿' }, { l: '已驳回', test: x => x.c3 === '已驳回' }] : [{ l: '全部' }, { l: '待审核', test: x => x.c3 === '待审核' }, { l: '已发布', test: x => x.c3 === '已发布' }], emptyTitle: '草稿箱是空的', emptyDesc: '所有草稿都已提交审核。可以从 AI 抽取工作台继续认领候选。', emptyCta: '前往 AI 抽取', emptyOn: () => this.go('collect.extract') });
    }

    if (r === 'review.queue') return mk('审核中心', '待我审核', '审核通过后知识立即发布，并把英文版本同步写入 Zendesk；驳回需填写意见，草稿回到提交人手中。',
      ['标题', '提交人', '状态', '提交时间', 'AI 置信'],
      s.docs.filter(d => d.status === 'pending').map(d => Object.assign(D(d), { c2: d.owner, c5: Math.round(d.conf * 100) + '%', acts: [{ l: '审核', on: () => this.openReview(d.id) }] })),
      { filters: [{ l: '全部' }, { l: '高置信 ≥85%', test: x => parseInt(x.c5) >= 85 }, { l: '待复核 <85%', test: x => parseInt(x.c5) < 85 }], emptyTitle: '待审队列已清空', emptyDesc: '没有等待审核的知识。新提交会实时出现在这里，并在工作台待办中提醒。', emptyCta: '返回工作台', emptyOn: () => this.go('dash') });

    if (r === 'review.log') return mk('审核中心', '审核记录', '所有审核结论留痕，可回溯到具体版本与意见。',
      ['标题', '审核人', '结论', '时间', '版本'],
      s.audit.filter(a => a.act.indexOf('审核通过') >= 0 || a.act === '驳回').map((a, i) => plain({ id: 'L' + i, c1: a.obj, sub: a.act, c2: a.who, c3: a.act === '驳回' ? '驳回' : '通过', tagCls: a.act === '驳回' ? 'tag-neutral' : 'tag-accent', c4: a.at, c5: '—', open: () => { }, acts: [{ l: '查看', on: () => this.setState({ drawerId: 'info:log' + i }) }] })),
      { emptyTitle: '暂无审核记录', emptyDesc: '完成第一次审核后，结论会记录在这里。', emptyCta: '前往待审队列', emptyOn: () => this.go('review.queue') });

    if (r === 'kb.list' || r === 'kb.offline') {
      const list = r === 'kb.offline' ? s.docs.filter(d => d.status === 'offline') : s.docs.filter(d => d.status !== 'offline');
      return mk('知识库', r === 'kb.offline' ? '已下线知识' : '全部知识', r === 'kb.offline' ? '下线知识不参与召回与同步，但版本、双语内容与反馈完整保留，可随时恢复。' : '知识库是中台的唯一事实来源。每条知识都带一级分类、二级场景、双语内容、版本质量与 Zendesk 同步状态。',
        ['标题', '场景', '状态', '更新时间', '健康度'],
        list.map(d => Object.assign(D(d), {
          acts: r === 'kb.offline'
            ? [{ l: '恢复', on: () => { this.patch(d.id, () => ({ status: 'draft' })); this.log(this.me().name, '恢复下线知识', d.id); this.toast('已恢复为草稿', d.id + ' 需重新提交审核后才能发布。', { l: '去编辑', r: 'author.editor', id: d.id }); } }]
            : [{ l: '详情', on: () => this.go('kb.detail', d.id) }, { l: '版本', on: () => { this.go('kb.detail', d.id); setTimeout(() => this.setState({ tab: 'versions' }), 400); } }]
        })),
        { actions: [{ l: '导出', cls: 'btn-secondary', on: () => this.toast('导出任务已创建', '共 ' + list.length + ' 条（含中英双语），完成后可在系统管理下载。', null) }], filters: r === 'kb.offline' ? [{ l: '全部' }] : [{ l: '全部' }, { l: '已发布', test: x => x.c3 === '已发布' }, { l: '待审核', test: x => x.c3 === '待审核' }, { l: '修复中', test: x => x.c3 === '修复中' }] });
    }

    if (r === 'publish.channels') return mk('发布与同步', 'Zendesk 同步', '对 Zendesk 的写入是同步进行的，无需发布队列。写入语言为英文；同步失败可单独重试。',
      ['知识', '同步版本', '状态', '最近同步', '健康度'],
      s.docs.filter(d => d.status === 'published' || d.sync !== 'none').map(d => plain({
        id: d.id, c1: d.titleZh, sub: d.id + ' · EN', c2: d.ver,
        c3: { synced: '已同步', pending: '同步中', failed: '同步失败', none: '未同步' }[d.sync],
        tagCls: { synced: 'tag-accent', pending: 'tag-accent-2', failed: 'tag-neutral', none: 'tag-neutral' }[d.sync],
        c4: d.sync === 'none' ? '—' : '08-05 11:42', c5: d.q, open: () => this.go('kb.detail', d.id),
        acts: d.sync === 'failed' ? [{ l: '重试', on: () => this.sync(d.id) }, { l: '日志', on: () => this.go('publish.logs') }] : [{ l: '重新下发', on: () => this.sync(d.id) }]
      })),
      { filters: [{ l: '全部' }, { l: '已同步', test: x => x.c3 === '已同步' }, { l: '同步失败', test: x => x.c3 === '同步失败' }] });

    if (r === 'publish.logs') return mk('发布与同步', '同步日志', '每一次对 Zendesk 的写入都有报文级留痕，失败可直接重试。',
      ['知识 → Zendesk', '目录', '结果', '时间', '耗时'],
      s.audit.filter(a => a.act === 'Zendesk 同步').concat([{ at: '08-04 14:23', who: '系统', act: 'Zendesk 同步', obj: 'KB-20421 英文版本（成功）' }]).map((a, i) => plain({ id: 'G' + i, c1: a.obj, sub: '报文 #' + (88210 + i), c2: 'Help Center', c3: a.obj.indexOf('失败') >= 0 ? '失败' : '成功', tagCls: a.obj.indexOf('失败') >= 0 ? 'tag-neutral' : 'tag-accent', c4: a.at, c5: (120 + i * 37) + 'ms', open: () => { }, acts: [{ l: '查看报文', on: () => this.setState({ drawerId: 'info:msg' + i }) }] })));

    if (r === 'feedback.list') return mk('反馈回流', '用户反馈', '主动从 Zendesk 拉取用户客诉聊天记录，按关联知识归集。可直接在本列表内完成忽略或去修复，无需单独的修复任务。',
      ['反馈内容', '关联知识', '类型', '来源 / 时间', '状态'],
      s.feedbacks.map(f => plain({
        id: f.id, c1: f.text, sub: f.id + ' · Zendesk ' + f.conv, c2: f.kb, c3: f.type, tagCls: f.type === '差评' ? 'tag-neutral' : 'tag-accent-2', c4: 'Zendesk · ' + f.at,
        c5: { open: '未处理', fixing: '修复中', closed: '已关闭' }[f.state],
        open: () => this.go('kb.detail', f.kb),
        acts: f.state === 'open' ? [{ l: '忽略', on: () => { this.setState(x => ({ feedbacks: x.feedbacks.map(y => y.id === f.id ? Object.assign({}, y, { state: 'closed' }) : y) })); this.log(this.me().name, '忽略反馈', f.id); } }, { l: '去修复', on: () => this.goFix(f) }] : f.state === 'fixing' ? [{ l: '继续修复', on: () => { this.go('author.editor', f.kb); this.setState({ ed: this.loadEd(this.doc(f.kb)) }); } }] : [{ l: '查看知识', on: () => this.go('kb.detail', f.kb) }]
      })), { actions: [{ l: '从 Zendesk 拉取', cls: 'btn-primary', on: () => this.pullZendesk() }], filters: [{ l: '全部' }, { l: '未处理', test: x => x.c5 === '未处理' }, { l: '修复中', test: x => x.c5 === '修复中' }, { l: '已关闭', test: x => x.c5 === '已关闭' }], emptyTitle: '暂无反馈', emptyDesc: '从 Zendesk 拉取后，客诉会汇总到这里。', emptyCta: '从 Zendesk 拉取', emptyOn: () => this.pullZendesk() });

    if (r === 'feedback.miss') return mk('反馈回流', '未命中问题', '召回为空或置信度过低的提问在此聚类，每条附 AI 摘要（问题类型与场景）。点击「待处理」查看处理流程，可一键「新建条目」撰写新知识覆盖该场景。',
      ['问题', '疑似场景', '状态', '近 7 日次数', '命中率'],
      s.misses.map(m => Object.assign({
        id: m.id, c1: m.q, sub: m.id + ' · AI 摘要：' + (m.summary || ''), c2: m.scene, c3: m.state === 'open' ? '待处理' : '已排期', tagCls: m.state === 'open' ? 'tag-outline' : 'tag-accent', c4: m.n7 + ' 次', c5: m.rate,
        c3on: m.state === 'open', c3plain: m.state !== 'open', c3click: () => this.setState({ drawerId: 'miss', missSel: m }),
        open: () => this.setState({ drawerId: 'miss', missSel: m }),
        acts: m.state === 'open' ? [{ l: '流程', on: () => this.setState({ drawerId: 'miss', missSel: m }) }, { l: '新建条目', on: () => this.createDraftFromMiss(m) }] : [{ l: '查看草稿', on: () => this.go('author.drafts') }]
      })));

    if (r === 'meta.tree') return mk('元数据中心', '知识分类（一级）', '一级分类对应 Zendesk 目录。用户录入中文，大模型翻译为英文并支持二次编辑；同步到 Zendesk 时使用英文名称。',
      ['分类（中文）', 'English', '状态', '二级场景', '知识数'],
      CATALOG.map((c, i) => plain({ id: c.zh, c1: c.zh, sub: 'CAT-' + (401 + i) + ' · Zendesk Category', c2: c.en, c3: this.metaOn(c.zh) ? '已上架' : '已下架', tagCls: this.metaOn(c.zh) ? 'tag-accent' : 'tag-neutral', c4: c.scenes.length + ' 个', c5: s.docs.filter(d => d.cat === c.zh).length,
        open: () => this.openMeta('分类', c.zh, c.en, ''), acts: [{ l: '编辑双语', on: () => this.openMeta('分类', c.zh, c.en, '') }, { l: this.metaOn(c.zh) ? '下架' : '上架', on: () => this.toggleMeta(c.zh, '分类') }, { l: '查看场景', on: () => this.go('meta.scenes') }] })),
      { actions: [{ l: '新增分类', cls: 'btn-primary', on: () => this.openMeta('分类', '', '', '') }] });

    if (r === 'meta.scenes') return mk('元数据中心', '问题场景（二级）', '二级场景挂在一级分类下，同样对应 Zendesk 目录，需中英双语。每条知识必须归属一个场景，场景覆盖率直接影响召回。',
      ['场景（中文）', 'English', '状态', '上级分类', '知识数'],
      ALL_SCENES.map((sc, i) => plain({ id: sc.zh, c1: sc.zh, sub: 'SCENE-' + (201 + i) + ' · Zendesk Section', c2: sc.en, c3: this.metaOn(sc.zh) ? '已上架' : '已下架', tagCls: this.metaOn(sc.zh) ? 'tag-accent' : 'tag-neutral', c4: catOfScene(sc.zh), c5: s.docs.filter(d => d.scene === sc.zh).length,
        open: () => this.openMeta('场景', sc.zh, sc.en, catOfScene(sc.zh)), acts: [{ l: '编辑双语', on: () => this.openMeta('场景', sc.zh, sc.en, catOfScene(sc.zh)) }, { l: this.metaOn(sc.zh) ? '下架' : '上架', on: () => this.toggleMeta(sc.zh, '场景') }, { l: '查看知识', on: () => this.go('kb.list') }] })),
      { actions: [{ l: '新增场景', cls: 'btn-primary', on: () => this.openMeta('场景', '', '', CATALOG[0].zh) }] });

    if (r === 'meta.tags') return mk('元数据中心', '知识标签', '标签仅用于本地检索与推荐适配，不做翻译。与分类、场景一致，支持新增、编辑与上下架；重复标签可合并，合并后引用自动改写。',
      ['标签', '类型', '状态', '引用数', '创建人'],
      [['国际机票', '业务', 42, '林静'], ['手续费', '属性', 38, '周迟'], ['改签', '动作', 65, '林静'], ['婴儿票', '人群', 12, '苏见'], ['值机', '动作', 27, '周迟'], ['退票手续费', '属性', 4, '陈默']].map((x, i) => plain({
        id: 'T' + i, c1: x[0], sub: 'TAG-' + (301 + i) + ' · 不翻译', c2: x[1], c3: this.metaOn(x[0]) ? '已上架' : '已下架', tagCls: this.metaOn(x[0]) ? 'tag-accent' : 'tag-neutral', c4: x[2] + ' 次', c5: x[3],
        open: () => this.openMeta('标签', x[0], '', x[1]), acts: [{ l: '编辑', on: () => this.openMeta('标签', x[0], '', x[1]) }, { l: this.metaOn(x[0]) ? '下架' : '上架', on: () => this.toggleMeta(x[0], '标签') }, { l: '合并', on: () => this.toast('合并标签', '选择目标标签后，' + x[0] + ' 的引用将自动改写。', null) }]
      })),
      { actions: [{ l: '新增标签', cls: 'btn-primary', on: () => this.openMeta('标签', '', '', '业务') }] });

    if (r === 'admin.users') return mk('系统管理', '用户与角色', '两类角色：超级管理员可配置系统与权限；知识运营负责采集、编辑、审核与反馈处理。',
      ['用户', '部门', '角色', '最近登录', '状态'],
      [['陈默', '知识中台', '超级管理员', '08-05 08:12', '正常'], ['苏见', '客服运营', '知识运营 · 审核', '08-05 10:02', '正常'], ['林静', '客服运营', '知识运营', '08-05 07:58', '正常'], ['周迟', '客服运营', '知识运营', '08-05 09:20', '正常'], ['王一诺', '产品', '知识运营', '07-22 14:00', '已停用']].map((x, i) => plain({
        id: 'U' + i, c1: x[0], sub: 'UID-' + (1001 + i), c2: x[1], c3: x[2], tagCls: x[2] === '超级管理员' ? 'tag-accent' : 'tag-neutral', c4: x[3], c5: x[4],
        open: () => { }, acts: [{ l: '编辑', on: () => this.setState({ drawerId: 'info:user' + i }) }, { l: x[4] === '已停用' ? '启用' : '停用', on: () => this.toast('账号状态已变更', x[0] + ' 已' + (x[4] === '已停用' ? '启用' : '停用') + '。', null) }]
      })), { actions: [{ l: '新增用户', cls: 'btn-primary', on: () => this.toast('新增用户', '需指定角色，角色决定可见模块与可执行操作。', null) }] });

    if (r === 'admin.perms') return mk('系统管理', '权限矩阵', '权限按「模块 × 操作」授予。运营角色不可进入系统管理，也不能删除已发布知识。',
      ['模块', '超级管理员', '知识运营', '备注', ''],
      [['知识采集', '全部', '全部', '两角色一致'], ['知识编辑', '全部', '全部', '仅本人草稿可删'], ['审核中心', '全部', '审核（需授权）', '审核权限单独授予'], ['知识库', '全部', '查看 / 编辑 / 下线', '删除仅超管'], ['发布与同步', '全部', '同步 / 重试', 'Zendesk 配置仅超管'], ['反馈回流', '全部', '全部', '两角色一致'], ['元数据中心', '全部', '新增 / 编辑 / 翻译', '删除仅超管'], ['数据分析', '全部', '查看', '导出仅超管'], ['系统管理', '全部', '不可见', '403 拦截']].map((x, i) => plain({
        id: 'P' + i, c1: x[0], sub: '模块 ' + String(i + 1).padStart(2, '0'), c2: x[1], c3: x[2] === '不可见' ? '不可见' : '受限', tagCls: x[2] === '不可见' ? 'tag-neutral' : x[2] === '全部' ? 'tag-accent' : 'tag-outline', c4: x[3], c5: '',
        open: () => { }, acts: [{ l: '调整', on: () => this.setState({ drawerId: 'info:perm' + i }) }]
      })));

    if (r === 'admin.audit') return mk('系统管理', '操作审计', '中台所有写操作实时留痕，含角色、对象与结果。这是排查数据流转问题的第一入口。',
      ['操作', '对象', '结果', '时间', '操作人'],
      s.audit.map((a, i) => plain({ id: 'A' + i, c1: a.act + ' · ' + a.obj, sub: '日志 #' + (90000 + s.audit.length - i), c2: '—', c3: a.obj.indexOf('失败') >= 0 ? '失败' : '成功', tagCls: a.obj.indexOf('失败') >= 0 ? 'tag-neutral' : 'tag-accent', c4: a.at, c5: a.who, open: () => { }, acts: [{ l: '详情', on: () => this.setState({ drawerId: 'info:audit' + i }) }] })),
      { actions: [{ l: '导出日志', cls: 'btn-secondary', on: () => this.toast('导出已开始', '将导出近 30 日全部操作日志（CSV）。', null) }] });

    return null;
  }

  createDraftFromMiss(m) {
    const nid = 'KB-2' + (600 + this.state.docs.length);
    const scene = ALL_SCENES.some(s2 => s2.zh === m.scene) ? m.scene : '';
    const cat = scene ? catOfScene(scene) : CATALOG[0].zh;
    const nd = { id: nid, titleZh: m.q, titleEn: '', scene, cat, status: 'draft', ver: 'v0.1', owner: this.me().name, at: '08-05 现在', q: 40, conf: 0, sync: 'none', adopt: 0, hits: 0, views: 0, bodyZh: '', bodyEn: '', translated: false, tags: [], fromMiss: m.id, src: '未命中 ' + m.id };
    this.setState(x => ({ docs: [nd, ...x.docs], misses: x.misses.map(y => y.id === m.id ? Object.assign({}, y, { state: 'planned' }) : y), drawerId: null }));
    this.log(this.me().name, '未命中新建条目', nid + ' ← ' + m.id);
    this.go('author.editor', nid); this.setState({ ed: this.loadEd(nd) });
    this.toast('已新建条目', nid + ' 草稿已生成（来源未命中 ' + m.id + '），撰写并翻译后提交审核即可覆盖该场景。', { l: '前往我的草稿', r: 'author.drafts' });
  }
  metaOn(id) { return this.state.metaState[id] !== 'off'; }
  toggleMeta(id, label) {
    const off = this.state.metaState[id] === 'off';
    this.setState(s => ({ metaState: Object.assign({}, s.metaState, { [id]: off ? 'on' : 'off' }) }));
    this.log(this.me().name, (off ? '上架' : '下架') + label, id);
    this.toast(off ? '已上架' : '已下架', label + '「' + id + '」已' + (off ? '上架，恢复对客展示' : '下架，不再对客展示') + '。', null);
  }
  openMeta(kind, zh, en, parent, type) { this.setState({ drawerId: 'meta', metaEdit: { kind, zh, en, parent, type: type || '业务', en0: en } }); }

  exVals() {
    const s = this.state, A = 'var(--color-accent)', M = 'var(--color-neutral-600)';
    const t = s.tasks.find(x => x.id === s.task) || s.tasks[0] || { src: 'Zendesk 客服会话' };
    return {
      ex: {
        taskTitle: '定时抽取 · 近 7 日 Zendesk 客诉聚类', taskMeta: '后台定时任务 · 每日 07:00 自动运行 · 来源 Zendesk 客服会话 · 最近运行 08-05 07:00',
        countText: s.cands.length + ' 条待确认，人工确认后才会生成草稿（抽取由后台定时任务完成，无需手动创建）',
        cands: s.cands.map(c => ({
          id: c.id, title: c.title, answer: c.answer, scene: c.scene, tags: c.tags,
          conf: Math.round(c.conf * 100) + '%', confPct: Math.round(c.conf * 100) + '%',
          confCol: c.conf > 0.8 ? A : M,
          state: c.conf > 0.8 ? '高置信' : c.conf > 0.6 ? '需复核' : '低置信',
          tagCls: c.conf > 0.8 ? 'tag-accent' : c.conf > 0.6 ? 'tag-outline' : 'tag-neutral',
          dup: c.dup, dupTitle: c.dupTitle, dupScore: c.dupScore,
          openDup: () => this.go('kb.detail', c.dupId),
          accept: () => this.acceptCand(c),
          drop: () => { this.setState(x => ({ cands: x.cands.filter(y => y.id !== c.id) })); this.log(this.me().name, '丢弃抽取候选', c.id); }
        })),
        empty: s.cands.length === 0,
        toDrafts: () => this.go('author.drafts'),
        sourceText: '【Zendesk 会话 · 2026-08-04 19:22 · ' + t.src + '】用户：我买的是带婴儿的票，现在想改后天的，婴儿票要单独改吗？坐席：您好，婴儿票是跟随成人票的，成人票改签后婴儿票会自动改到同一航班，不需要单独操作，差价会按新航段的婴儿票价重新算。用户：那要是我只改婴儿不改大人呢？坐席：这个不支持的，婴儿票不能脱离成人票单独存在。',
        sourceMeta: '来自 Zendesk · ' + t.src + ' · 共 24 段 · 已解析 24 段',
        config: [{ k: '来源', v: 'Zendesk（固定）' }, { k: '抽取模型', v: 'claude-sonnet' }, { k: '置信度阈值', v: '0.60' }, { k: '查重相似度', v: '≥ 85% 提示' }]
      }
    };
  }

  edVals() {
    const s = this.state;
    const e = s.ed || (this.doc() ? this.loadEd(this.doc()) : this.loadEd(s.docs[0]));
    const errs = [];
    if (!e.scene) errs.push('未选择问题场景（必填）');
    if (!e.title || e.title === '未命名知识') errs.push('中文标题为空或仍为默认值');
    if (!e.translated) errs.push('尚未翻译为英文（Zendesk 同步需要英文版本）');
    const setF = k => ev => this.setState(x => ({ ed: Object.assign({}, e, { [k]: ev.target.value }) }));
    const sug = [
      { text: '正文缺少「特殊情形」段落，建议补充不可抗力场景的处理口径。' },
      { text: '检测到与 KB-20460 有 34% 内容重叠，可考虑互相引用而非重复描述。' }
    ];
    const scenes = e.cat ? scenesOf(e.cat) : [];
    return {
      ed: {
        id: e.id, ver: e.ver, status: ST[e.status] ? ST[e.status].l : '草稿', tagCls: ST[e.status] ? ST[e.status].c : 'tag-neutral',
        crumb: '知识编辑 / ' + (e.title || '新建知识'), saveHint: '已自动保存 · 08-05 11:48',
        title: e.title, titleEn: e.titleEn, note: e.note,
        setTitle: setF('title'), setTitleEn: setF('titleEn'), setNote: setF('note'),
        setScene: setF('scene'),
        setCat: ev => { const cat = ev.target.value; this.setState({ ed: Object.assign({}, e, { cat, scene: scenesOf(cat).some(x => x.zh === e.scene) ? e.scene : '' }) }); },
        cat: e.cat, scene: e.scene, catEn: e.cat ? catEn(e.cat) : '选择分类后显示', sceneEn: e.scene ? sceneEn(e.scene) : '选择场景后显示',
        scenePh: e.cat ? '请选择二级场景' : '请先选择一级分类', sceneOpts: scenes,
        hasError: !!s.edErr && errs.length > 0, errCount: errs.length, errors: errs, sceneErr: !!s.edErr && !e.scene,
        tags: (e.tags || []).map(t => ({ l: t, remove: () => this.setState({ ed: Object.assign({}, e, { tags: e.tags.filter(x => x !== t) }) }) })),
        tagSug: ['退票', '国际机票', '费率表', '不可抗力'].filter(t => (e.tags || []).indexOf(t) < 0).slice(0, 4).map(t => ({ l: t, add: () => this.setState({ ed: Object.assign({}, e, { tags: (e.tags || []).concat([t]) }) }) })),
        tools: [
          { l: 'B', ff: 'var(--font-body)', tip: '加粗', on: () => this.rt('bold') },
          { l: 'I', ff: 'var(--font-body)', tip: '斜体', on: () => this.rt('italic') },
          { l: 'H', ff: 'var(--font-heading)', tip: '小标题', on: () => this.rt('formatBlock', '<h4>') },
          { l: '•', ff: 'var(--font-body)', tip: '项目符号', on: () => this.rt('insertUnorderedList') },
          { l: '¶', ff: 'var(--font-body)', tip: '正文段落', on: () => this.rt('formatBlock', '<p>') }
        ],
        keep: ev => ev.preventDefault(),
        refZh: node => { this._zhEl = node; if (node) { node.contentEditable = 'true'; const k = e.id + ':zh'; if (node.dataset.k !== k) { node.innerHTML = this.htmlOf(e.bodyZh || ''); node.dataset.k = k; } } },
        refEn: node => { this._enEl = node; if (node) { node.contentEditable = 'true'; const k = e.id + ':en:' + e.transN; if (node.dataset.k !== k) { node.innerHTML = e.bodyEn ? this.htmlOf(e.bodyEn) : ''; node.dataset.k = k; } } },
        showEn: e.translated, noEn: !e.translated,
        transStatus: e.translated ? (e.enEdited ? '英文版本已生成，且经过人工二次编辑。Zendesk 同步将使用此英文版本。' : '英文版本已由大模型生成，可在下方二次编辑后再提交。') : '用户以中文录入，点击右侧按钮由大模型同步翻译为英文。Zendesk 同步的是英文版本。',
        transLabel: e.translated ? '重新翻译' : '翻译为英文',
        transBtnCls: e.translated ? 'btn-secondary' : 'btn-primary',
        transChip: e.translated ? '中 / EN 已翻译' : '仅中文 · 未翻译',
        transTagCls: e.translated ? 'tag-accent' : 'tag-outline',
        transState: e.translated ? '已完成' : '未执行', transDotCol: e.translated ? 'var(--color-accent-700)' : 'var(--color-neutral-600)',
        enEdited: e.enEdited ? '有' : '无',
        translate: () => {
          const zh = this._zhEl ? this._zhEl.innerHTML : e.bodyZh;
          const enTitle = this.translateTitle(e.title);
          const enBody = this.translateBody(zh, e.cat);
          this.setState({ ed: Object.assign({}, e, { bodyZh: zh, titleEn: enTitle, bodyEn: enBody, translated: true, enEdited: false, transN: e.transN + 1 }) });
          this.toast('翻译完成', '大模型已生成英文标题与正文，可在下方二次编辑。', null);
        },
        showAi: this.props.showAiAssist !== false && (e.ai || []).length > 0,
        aiDone: this.props.showAiAssist !== false && (e.ai || []).length === 0,
        aiSug: (e.ai || []).map(i => ({
          text: sug[i].text,
          apply: () => { const add = '\n\n五、补充说明（AI 建议已采纳）。不可抗力情形以航司当次公告为准，坐席须引用公告编号并说明生效时间。'; if (this._zhEl) this._zhEl.innerHTML = this._zhEl.innerHTML + '<p>五、补充说明（AI 建议已采纳）。不可抗力情形以航司当次公告为准。</p>'; this.setState({ ed: Object.assign({}, e, { ai: e.ai.filter(x => x !== i), bodyZh: (this._zhEl ? this._zhEl.innerHTML : e.bodyZh) }) }); this.toast('建议已采纳', '内容已插入中文正文末尾。翻译需重新执行以同步到英文。', null); },
          skip: () => this.setState({ ed: Object.assign({}, e, { ai: e.ai.filter(x => x !== i) }) })
        })),
        back: () => this.go('author.drafts'),
        save: () => {
          const zh = this._zhEl ? this._zhEl.innerHTML : e.bodyZh;
          const en = this._enEl ? this._enEl.innerHTML : e.bodyEn;
          const enEdited = e.enEdited || (e.translated && en !== this.htmlOf(e.bodyEn));
          this.setState({ ed: Object.assign({}, e, { bodyZh: zh, bodyEn: en, enEdited }) });
          this.patch(e.id, () => ({ titleZh: e.title, titleEn: e.titleEn, scene: e.scene, cat: e.cat, bodyZh: zh, bodyEn: en, tags: e.tags, translated: e.translated, note: e.note, at: '08-05 现在' }));
          this.log(this.me().name, '保存草稿', e.id + ' ' + e.title);
          this.toast('草稿已保存', e.id + ' ' + e.ver + ' 已保存（中 + EN），未提交审核，线上不受影响。', null);
        },
        submit: () => {
          const zh = this._zhEl ? this._zhEl.innerHTML : e.bodyZh;
          const en = this._enEl ? this._enEl.innerHTML : e.bodyEn;
          if (errs.length) { this.setState({ edErr: true, ed: Object.assign({}, e, { bodyZh: zh, bodyEn: en }) }); this.toast('无法提交', '有 ' + errs.length + ' 项未通过校验，请先修正（含英文翻译）。', null); return; }
          this.patch(e.id, () => ({ titleZh: e.title, titleEn: e.titleEn, scene: e.scene, cat: e.cat, bodyZh: zh, bodyEn: en, tags: e.tags, translated: true, status: 'pending', at: '08-05 现在' }));
          this.setState({ edErr: false });
          this.log(this.me().name, '提交审核', e.id + ' ' + e.title);
          this.toast('已提交审核', e.id + ' 进入待审队列。审核通过后英文版本自动写入 Zendesk。', { l: '前往审核中心', r: 'review.queue' });
          this.go('author.drafts');
        }
      }
    };
  }
  rt(cmd, val) { try { document.execCommand(cmd, false, val || null); } catch (e) { } }

  dtVals() {
    const s = this.state, A = 'var(--color-accent)', T = 'var(--color-text)', M = 'var(--color-neutral-600)';
    const d = this.doc() || s.docs[0];
    let vers = s.versions[d.id];
    if (!vers) vers = [{ v: d.ver, at: '2026-08-05 09:00', by: d.owner, act: d.status === 'published' ? '发布' : '创建', note: '当前版本', adopt: d.adopt, hits: d.hits }, { v: this.priorVer(d.ver), at: '2026-07-20 10:00', by: '周迟', act: '发布', note: '上一版本', adopt: Math.max(0, d.adopt + 8), hits: Math.round(d.hits * 0.7) }];
    const prior = vers.filter(v => v.v !== d.ver);
    const best = prior.reduce((a, v) => (v.adopt > (a ? a.adopt : -1) ? v : a), null);
    const qualityWarn = d.status === 'published' && best && best.adopt - d.adopt >= 15;
    const fbs = s.feedbacks.filter(f => f.kb === d.id);
    const tabs = [['content', '内容'], ['versions', '版本与质量 · ' + vers.length], ['sync', 'Zendesk 同步'], ['feedback', '反馈 · ' + fbs.length]];
    const acts = [];
    if (d.status === 'published') {
      acts.push({ l: '下线', cls: 'btn-secondary', on: () => this.setState({ modal: { type: 'offline', id: d.id } }) });
      acts.push({ l: '创建修订', cls: 'btn-primary', on: () => this.startRevision(d.id) });
    } else if (d.status === 'draft' || d.status === 'rejected' || d.status === 'fixing') {
      acts.push({ l: '编辑', cls: 'btn-secondary', on: () => { this.go('author.editor', d.id); this.setState({ ed: this.loadEd(d) }); } });
      acts.push({ l: '提交审核', cls: 'btn-primary', on: () => this.submitReview(d.id) });
    } else if (d.status === 'pending') {
      acts.push({ l: '前往审核', cls: 'btn-primary', on: () => this.openReview(d.id) });
    } else if (d.status === 'offline') {
      acts.push({ l: '恢复为草稿', cls: 'btn-primary', on: () => { this.patch(d.id, () => ({ status: 'draft' })); this.toast('已恢复', d.id + ' 回到草稿状态，需重新审核。', { l: '去编辑', r: 'author.editor', id: d.id }); } });
    }
    const adoptCol = a => a >= 60 ? 'var(--color-accent-700)' : a >= 40 ? 'var(--color-accent)' : 'var(--color-neutral-500)';
    const zdMsgs = fbs.map(f => ({ id: f.conv, type: f.type, tagCls: f.type === '差评' ? 'tag-neutral' : 'tag-accent-2', text: f.text, at: f.at, on: () => this.setState({ drawerId: 'info:' + f.conv }) }));
    if (d.sync !== 'none') zdMsgs.unshift({ id: 'ZD-SYNC', type: '同步', tagCls: 'tag-accent', text: '英文版本 ' + d.ver + ' 写入 Zendesk Help Center', at: '08-05 11:42', on: () => this.go('publish.logs') });
    const paras = s.lang === 'en' ? (d.bodyEn || this.translateBody(d.bodyZh, d.cat)).split('\n\n') : (d.bodyZh || this.bodyOf(d)).split('\n\n');
    return {
      dt: {
        id: d.id, title: d.titleZh, titleEn: d.titleEn || sceneEn(d.scene), ver: d.ver, owner: d.owner, cat: d.cat, scene: d.scene,
        status: ST[d.status].l, statusReadable: ST[d.status].d, tagCls: ST[d.status].c, actions: acts,
        back: () => this.go('kb.list'),
        tabs: tabs.map(t => ({ l: t[1], on: () => this.setState({ tab: t[0] }), col: s.tab === t[0] ? A : M, bar: s.tab === t[0] ? A : 'transparent' })),
        tabContent: s.tab === 'content', tabVersions: s.tab === 'versions', tabSync: s.tab === 'sync', tabFeedback: s.tab === 'feedback',
        langTabs: [{ l: '中文', k: 'zh' }, { l: 'English', k: 'en' }].map(x => ({ l: x.l, cls: s.lang === x.k ? 'tag-accent' : 'tag-outline', on: () => this.setState({ lang: x.k }) })),
        paras,
        qualityWarn, qualityTarget: best ? best.v : '',
        qualityText: qualityWarn ? ('当前版本 ' + d.ver + ' 采纳率仅 ' + d.adopt + '%，较历史最佳版本 ' + best.v + '（' + best.adopt + '%）下降 ' + (best.adopt - d.adopt) + ' 个百分点，命中虽高但采纳明显走低。建议回滚至 ' + best.v + '，或基于其重做修订。') : '',
        qualityRollback: () => best && this.setState({ modal: { type: 'rollback', id: d.id, v: best.v } }),
        versions: vers.map(v => ({
          v: v.v, note: v.note, by: v.by, at: v.at, act: ({ '发布': '发布上线', '回滚': '版本回滚', '创建': '新建条目' }[v.act] || v.act), isCurrent: v.v === d.ver,
          col: v.v === d.ver ? A : M, canRollback: v.v !== d.ver && d.status === 'published',
          adopt: v.adopt + '%', adoptPct: v.adopt + '%', adoptCol: adoptCol(v.adopt), adoptN: Math.round((v.hits || 0) * (v.adopt || 0) / 100).toLocaleString(), hits: (v.hits || 0).toLocaleString(),
          rollback: () => this.setState({ modal: { type: 'rollback', id: d.id, v: v.v } })
        })),
        syncVer: d.ver, syncState: { synced: '已同步', pending: '同步中', failed: '同步失败', none: '未同步' }[d.sync],
        syncTagCls: { synced: 'tag-accent', pending: 'tag-accent-2', failed: 'tag-neutral', none: 'tag-neutral' }[d.sync],
        syncCta: d.sync === 'failed' ? '重试同步' : d.sync === 'none' ? '不可用' : '重新下发',
        syncBtnCls: d.sync === 'failed' ? 'btn-primary' : 'btn-secondary',
        syncRetry: () => d.sync === 'none' ? this.toast('尚未发布', '该知识未进入发布状态，无法同步 Zendesk。', null) : this.sync(d.id),
        syncFailed: d.sync === 'failed', zdMsgs,
        feedback: fbs.map(f => ({ type: f.type, tagCls: f.type === '差评' ? 'tag-neutral' : 'tag-accent-2', text: f.text, meta: f.id + ' · Zendesk ' + f.conv + ' · ' + f.at + ' · ' + { open: '未处理', fixing: '修复中', closed: '已关闭' }[f.state], cta: f.state === 'open' ? '去修复' : '查看', on: () => f.state === 'open' ? this.goFix(f) : this.go('feedback.list') })),
        noFeedback: fbs.length === 0,
        meta: [
          { k: '知识 ID', v: d.id }, { k: '一级分类', v: d.cat + ' / ' + catEn(d.cat) }, { k: '二级场景', v: (d.scene || '未设置') + ' / ' + sceneEn(d.scene) },
          { k: '标签', v: (d.tags || []).join(' / ') || '—' }, { k: '来源', v: d.src || '人工撰写' }, { k: '累计命中', v: (d.hits || 0).toLocaleString() }, { k: '最近更新', v: '2026-' + d.at }
        ],
        health: d.q, healthNote: d.q >= 85 ? '健康' : d.q >= 60 ? '需关注' : '建议修复',
        healthBars: [
          { l: '命中率', v: Math.round(d.conf * 100) + '%', pct: Math.round(d.conf * 100) + '%' },
          { l: '采纳率', v: d.adopt + '%', pct: d.adopt + '%' }
        ]
      }
    };
  }
  priorVer(v) { const m = /v(\d+)\.(\d+)/.exec(v) || [0, 1, 0]; return +m[2] > 0 ? 'v' + m[1] + '.' + (+m[2] - 1) : 'v' + Math.max(0, +m[1] - 1) + '.0'; }

  rvVals() {
    const s = this.state;
    const id = s.drawerId && s.drawerId.indexOf('info:') < 0 && s.drawerId !== 'meta' && s.drawerId !== 'miss' ? s.drawerId : s.sel;
    const d = this.doc(id) || s.docs.find(x => x.status === 'pending') || s.docs[2];
    const pend = s.docs.filter(x => x.status === 'pending');
    const diff = [
      { n: 1, text: '一、适用范围。本条款适用于 COOLFLY 平台出票的国际机票订单。', t: 'same' },
      { n: 2, text: '二、费率。起飞前 7 日以上按票面价 5% 收取；7 日内至 24 小时按 10%。', t: 'del' },
      { n: 3, text: '二、费率。起飞前 7 日以上按票面价 5%；7 日内至 24 小时按 10%；24 小时至 4 小时按 20%。', t: 'add' },
      { n: 4, text: '三、特殊情形。因航司原因导致的变更不收取任何费用。', t: 'same' },
      { n: 5, text: '四、生效日期。本版自 2026 年 8 月 1 日起执行，此前出票订单按原政策。', t: 'add' }
    ];
    const bg = { same: 'transparent', del: 'var(--color-neutral-100)', add: 'var(--color-accent-100)' };
    const col = { same: 'var(--color-text)', del: 'var(--color-neutral-500)', add: 'var(--color-accent-800)' };
    const gut = { same: 'transparent', del: 'var(--color-neutral-200)', add: 'var(--color-accent-200)' };
    return {
      rv: {
        id: d.id, title: d.titleZh, index: Math.max(1, pend.indexOf(d) + 1), total: pend.length,
        meta: d.owner + ' 提交 · ' + d.at + ' · 场景 ' + (d.scene || '未设置') + (d.pendingKind === 'rollback' ? ' · 类型 版本回滚（→ ' + d.pendingVer + '）' : ' · 英文版本 ' + (d.translated ? '已就绪' : '缺失')) + ' · AI 置信度 ' + Math.round(d.conf * 100) + '%',
        diffLabel: d.pendingKind === 'rollback' ? (d.pendingVer + ' ← ' + d.ver + ' · 回滚审核') : (this.bump(d.ver, true) + ' ← ' + d.ver),
        diff: diff.map(x => ({ n: x.n, text: x.text, bg: bg[x.t], col: col[x.t], gut: gut[x.t] })),
        comment: s.comment, setComment: e => this.setState({ comment: e.target.value }),
        quick: ['费率与新政策不符', '缺少生效日期', '英文翻译有误', '话术过长需精简'].map(q => ({ l: q, on: () => this.setState({ comment: q }) })),
        checks: [
          { mark: '✓', col: 'var(--color-accent-700)', l: '事实一致性', detail: '与 3 条关联知识无冲突' },
          { mark: '✓', col: 'var(--color-accent-700)', l: '中英一致性', detail: '英文版本与中文语义一致' },
          { mark: '!', col: 'var(--color-accent-600)', l: '重复内容', detail: '与 KB-20460 相似度 34%，建议互相引用' },
          { mark: '✓', col: 'var(--color-accent-700)', l: '结构完整度', detail: '标题、正文、场景、双语齐全' },
          { mark: '!', col: 'var(--color-accent-600)', l: '时效性', detail: '正文含日期，建议确认生效日期正确' }
        ],
        info: [
          { k: '知识 ID', v: d.id }, { k: '提交人', v: d.owner }, { k: '目标版本', v: this.bump(d.ver, true) },
          { k: '二级场景', v: d.scene || '未设置' }, { k: '同步目标', v: 'Zendesk（英文）' }, { k: '来源', v: d.src || '人工撰写' }
        ],
        back: () => this.go('review.queue'),
        approve: () => this.approve(d.id), reject: () => this.reject(d.id)
      }
    };
  }

  hlVals() {
    const s = this.state, A = 'var(--color-accent)', M = 'var(--color-neutral-600)';
    const avg = Math.round(s.docs.reduce((a, d) => a + d.q, 0) / s.docs.length);
    return {
      hl: {
        kpis: [
          { label: '平均健康度', value: avg, delta: '较上周 +3' },
          { label: '平均采纳率', value: Math.round(s.docs.filter(d => d.adopt).reduce((a, d) => a + d.adopt, 0) / Math.max(1, s.docs.filter(d => d.adopt).length)) + '%', delta: '较上周 -4pt' },
          { label: '场景覆盖率', value: '77%', delta: '部分二级场景偏低' }
        ],
        dist: [
          { l: '已发布', n: s.docs.filter(d => d.status === 'published').length },
          { l: '待审核', n: s.docs.filter(d => d.status === 'pending').length },
          { l: '草稿', n: s.docs.filter(d => d.status === 'draft').length },
          { l: '修复中', n: s.docs.filter(d => d.status === 'fixing').length },
          { l: '已下线', n: s.docs.filter(d => d.status === 'offline').length }
        ],
        scenes: ALL_SCENES.map((sc, i) => { const v = [92, 74, 88, 61, 83, 55, 70, 96, 90, 66][i] || 70; return { l: sc.zh, v: v + '%', pct: v + '%' }; }),
        risky: s.docs.filter(d => d.status !== 'offline' && ((d.status === 'published' && d.adopt < 45) || d.conf < 0.72)).sort((a, b) => a.conf - b.conf).map(d => ({
          score: d.q, col: (d.status === 'published' && d.adopt < 40) ? A : M, title: d.titleZh,
          reason: (d.status === 'published' && d.adopt < 45) ? '采纳率偏低（' + d.adopt + '%），建议复核或回滚至更优版本' : '召回置信偏低（' + Math.round(d.conf * 100) + '%），建议补充内容与同义表达',
          on: () => this.startRevision(d.id)
        }))
      }
    };
  }

  drawerVals() {
    const s = this.state, id = s.drawerId;
    if (!id) return { drawer: { open: false, actions: [], rows: [] }, meta: {}, miss: {} };

    if (id === 'meta') {
      const m = s.metaEdit || { kind: '分类', zh: '', en: '', parent: '', type: '业务' };
      const setM = k => ev => this.setState({ metaEdit: Object.assign({}, m, { [k]: ev.target.value }) });
      const isTag = m.kind === '标签';
      return {
        drawer: {
          open: true, isMeta: true, isReview: false, isInfo: false, isMiss: false,
          kicker: (m.zh ? '编辑' : '新增') + m.kind + (isTag ? ' · 本地维护' : ' · 中英双语'), title: m.zh || ('新增' + m.kind), meta: isTag ? '仅本地，不同步 Zendesk' : (m.kind === '场景' ? '对应 Zendesk Section' : '对应 Zendesk Category'),
          actions: [{ l: '取消', cls: 'btn-secondary', on: () => this.setState({ drawerId: null, metaEdit: null }) }, { l: '保存', cls: 'btn-primary', on: () => { this.setState({ drawerId: null, metaEdit: null }); this.log(this.me().name, (m.zh ? '保存' : '新增') + m.kind, m.zh + (isTag ? '' : ' / ' + m.en)); this.toast('已保存', isTag ? (m.kind + '「' + m.zh + '」已保存（本地，不翻译）。') : (m.kind + '「' + m.zh + '」英文名「' + m.en + '」已保存，将同步至 Zendesk 目录。'), null); } }],
          close: () => this.setState({ drawerId: null, metaEdit: null })
        },
        meta: {
          zhLabel: m.kind, zh: m.zh, en: m.en, parent: m.parent, hasParent: m.kind === '场景',
          isTag, showEn: !isTag, type: m.type, setType: setM('type'),
          setZh: setM('zh'), setEn: setM('en'),
          status: m.en ? (m.en === m.en0 && m.en0 ? '英文名已存在，可直接编辑或重新翻译' : '已翻译，可二次编辑') : '未翻译',
          transLabel: m.en ? '重新翻译' : '翻译',
          note: isTag ? '标签仅用于本地检索与推荐适配，不翻译。保存后可在列表中上下架。' : '分类与场景对应 Zendesk 目录，同步 Zendesk 时使用英文名称。用户录入中文，大模型翻译为英文并支持人工二次编辑；标签不翻译。',
          translate: () => { const en = this.metaTranslate(m.zh, m.kind); this.setState({ metaEdit: Object.assign({}, m, { en }) }); this.toast('翻译完成', '「' + m.zh + '」→「' + en + '」，可二次编辑。', null); }
        }, miss: {}
      };
    }

    if (id === 'miss') {
      const m = s.missSel || { q: '', scene: '', n7: 0, rate: '0%', summary: '' };
      const steps = [
        { l: '登记未命中问题', d: '召回为空或低置信的提问自动聚类到此，并生成 AI 摘要。', st: 'done' },
          { l: '新建条目 · 撰写新知识', d: '直接新建草稿，用新知识覆盖该未命中场景。', st: 'current' },
        { l: '补全正文并翻译', d: '补全中文正文、选择场景，翻译为英文。', st: 'todo' },
        { l: '提交审核并发布', d: '审核通过后写入知识库并同步 Zendesk。', st: 'todo' },
        { l: '回流验证', d: '在坐席 / 用户侧验证该问题已可命中。', st: 'todo' }
      ];
      const mp = { done: { ring: 'var(--color-accent)', fill: 'var(--color-accent)', fg: 'var(--color-bg)', titleCol: 'var(--color-text)' }, current: { ring: 'var(--color-accent)', fill: 'var(--color-accent-100)', fg: 'var(--color-accent-800)', titleCol: 'var(--color-accent-800)' }, todo: { ring: 'var(--color-divider)', fill: 'transparent', fg: 'var(--color-neutral-500)', titleCol: 'var(--color-neutral-600)' } };
      return {
        drawer: {
          open: true, isMiss: true, isMeta: false, isReview: false, isInfo: false,
          kicker: '未命中问题 · 处理流程', title: m.id || '未命中问题', meta: '疑似场景 ' + m.scene,
          actions: [{ l: '关闭', cls: 'btn-secondary', on: () => this.setState({ drawerId: null }) }, { l: '新建条目', cls: 'btn-primary', on: () => this.createDraftFromMiss(m) }],
          close: () => this.setState({ drawerId: null })
        },
        miss: {
          q: m.q, scene: m.scene, n7: m.n7, rate: m.rate, summary: m.summary || '—',
          steps: steps.map((x, i) => Object.assign({ n: i + 1, l: x.l, d: x.d, current: x.st === 'current', line: i < steps.length - 1 }, mp[x.st]))
        }, meta: {}
      };
    }

    if (id.indexOf('info:') === 0) {
      return {
        drawer: {
          open: true, isInfo: true, isReview: false, isMeta: false, isMiss: false, kicker: '详情', title: '记录详情', meta: id.slice(5),
          rows: [{ k: '记录标识', v: id.slice(5) }, { k: '发生时间', v: '2026-08-05 11:42:08' }, { k: '操作角色', v: this.me().roleLabel }, { k: '结果', v: id.indexOf('msg') >= 0 ? '失败' : '成功' }, { k: '关联对象', v: s.sel || 'KB-20418' }],
          body: '本抽屉展示所选记录的完整字段与报文。开发实现时应返回该记录的原始 JSON、上下游关联 ID（如 Zendesk 会话号）与重试入口，保证任何一条流转记录都能被追溯到源头。',
          actions: [{ l: '关闭', cls: 'btn-secondary', on: () => this.setState({ drawerId: null }) }],
          close: () => this.setState({ drawerId: null })
        }, meta: {}, miss: {}
      };
    }

    const d = this.doc(id) || s.docs[0];
    return {
      drawer: {
        open: true, isReview: true, isInfo: false, isMeta: false, isMiss: false, kicker: '审核 · ' + d.id, title: d.titleZh,
        meta: d.owner + ' 提交 · ' + d.at + ' · 目标版本 ' + this.bump(d.ver, true),
        rows: [], body: null,
        actions: [{ l: '驳回', cls: 'btn-secondary', on: () => this.reject(d.id) }, { l: '通过并发布', cls: 'btn-primary', on: () => this.approve(d.id) }],
        close: () => this.setState({ drawerId: null, comment: '' })
      }, meta: {}, miss: {}
    };
  }
  metaTranslate(zh, kind) {
    const found = kind === '场景' ? sceneEn(zh) : catEn(zh);
    if (found && found !== '—') return found;
    return '[MT] ' + zh;
  }

  modalVals() {
    const m = this.state.modal;
    if (!m) return { modal: { open: false } };
    if (m.type === 'rollback') {
      const vd = (this.state.versions[m.id] || []).find(x => x.v === m.v) || {};
      return { modal: { open: true, title: '回滚至 ' + m.v, confirmLabel: '提交回滚审核', body: '将发起把 ' + m.id + ' 的线上内容回滚至 ' + m.v + ' 的版本（历史采纳率 ' + (vd.adopt || 0) + '%）。回滚需经过审核工作流，审核通过后才生效并重新同步 Zendesk。', warn: '提交后该知识状态变为「待审核」，在审核中心通过后回滚才会写入 Zendesk。', cancel: () => this.setState({ modal: null }), confirm: () => this.rollbackSubmit(m.id, m.v), hasInput: false } };
    }
    return { modal: { open: true, title: '下线知识', confirmLabel: '确认下线', body: '下线后 ' + m.id + ' 将从 Zendesk 撤回，不再参与召回。版本历史、双语内容与反馈记录完整保留，可随时恢复。', warn: '近 7 日该知识被召回多次，下线可能导致相关提问无召回。', cancel: () => this.setState({ modal: null }), confirm: () => { this.patch(m.id, () => ({ status: 'offline', sync: 'none' })); this.log(this.me().name, '下线知识', m.id); this.setState({ modal: null }); this.toast('已下线', m.id + ' 已从 Zendesk 撤回。', { l: '查看已下线', r: 'kb.offline' }); }, hasInput: false } };
  }
}
