/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Point {
  x: number;
  y: number;
}

export type ItemType = 'RELIC' | 'HOLY_WATER';

export interface Item extends Point {
  id: string;
  type: ItemType;
}

export type Difficulty = 'NORMAL' | 'DESPAIR';

export interface GameState {
  playerPos: Point;
  monsterPos: Point;
  isCaught: boolean;
  score: number;
  scareLevel: number;
  gameStarted: boolean;
  items: Item[];
  inventory: ItemType[];
  monsterStunnedUntil: number;
  difficulty: Difficulty;
  showGallery: boolean;
  floor: number;
  staircasePos: Point | null;
  mansionEscaped: boolean;
}

export const WORLD_SIZE = 3000;
export const PLAYER_SPEED = 6;
export const MONSTER_BASE_SPEED = 4;
export const VISION_RADIUS = 350;
export const ITEM_COUNT = 8;
