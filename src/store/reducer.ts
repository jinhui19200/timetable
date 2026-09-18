import type { AppData, Entry, PeriodSlot, SemesterConfig } from '../types/entry';

/**
 * 全局状态的 reducer。
 *
 * 所有对数据的修改都必须经过这里 —— 这是「表单是唯一写入口」这条约束的落地点：
 * 点空格子新建、点加号新建、详情页编辑这三条路径，最终都 dispatch 同一批 action。
 * 如果将来要接截图识别或文件导入，那些导入源也只能走这里，不能另开一条写数据的路。
 */

export type AppAction =
  | { type: 'entry/add'; entry: Entry }
  | { type: 'entry/update'; entry: Entry }
  | { type: 'entry/remove'; id: string }
  | { type: 'semester/set'; semester: SemesterConfig }
  | { type: 'periods/set'; periods: PeriodSlot[] }
  | { type: 'data/replace'; data: AppData };

export function appReducer(state: AppData, action: AppAction): AppData {
  switch (action.type) {
    case 'entry/add':
      return { ...state, entries: [...state.entries, action.entry] };

    case 'entry/update':
      // updatedAt 统一在这里盖章，避免每个调用点各写一遍、漏掉某个入口
      return {
        ...state,
        entries: state.entries.map((entry) =>
          entry.id === action.entry.id
            ? { ...action.entry, updatedAt: new Date().toISOString() }
            : entry,
        ),
      };

    case 'entry/remove':
      return { ...state, entries: state.entries.filter((entry) => entry.id !== action.id) };

    case 'semester/set':
      return { ...state, semester: action.semester };

    case 'periods/set':
      return { ...state, periods: action.periods };

    case 'data/replace':
      return action.data;

    default:
      return state;
  }
}

/** action 构造器，让调用点不必手写 type 字符串（写错了编译器也发现不了）。 */
export const appActions = {
  addEntry: (entry: Entry): AppAction => ({ type: 'entry/add', entry }),
  updateEntry: (entry: Entry): AppAction => ({ type: 'entry/update', entry }),
  removeEntry: (id: string): AppAction => ({ type: 'entry/remove', id }),
  setSemester: (semester: SemesterConfig): AppAction => ({ type: 'semester/set', semester }),
  setPeriods: (periods: PeriodSlot[]): AppAction => ({ type: 'periods/set', periods }),
  replaceData: (data: AppData): AppAction => ({ type: 'data/replace', data }),
};
