import db from '../db/db';
import { ItemGroup } from '../api/itemGroups';

const insertItemGroups = db.prepare(`
  INSERT OR REPLACE INTO item_groups (
    name,
    parent_item_group,
    image,
    custom_is_favorite_group
  ) VALUES (
    @name,
    @parent_item_group,
    @image,
    @custom_is_favorite_group
  )
`);

const insertItemGroupsBatch = db.transaction((itemGroups: ItemGroup[]) => {
  for (const group of itemGroups) {
    insertItemGroups.run({
      name: group.name,
      parent_item_group: group.parent_item_group || null,
      image: group.image || null,
      custom_is_favorite_group: group.custom_is_favorite_group || 0,
    });
  }
});

export const saveItemGroups = (itemGroups: ItemGroup[]) => {
  if (!itemGroups || itemGroups.length === 0) return;
  insertItemGroupsBatch(itemGroups);
};

export const getItemGroupsList = (): ItemGroup[] => {
  const stmt = db.prepare(`
    SELECT
      name,
      parent_item_group,
      image,
      custom_is_favorite_group
    FROM item_groups
    ORDER BY custom_is_favorite_group DESC, name ASC
  `);
  return stmt.all() as ItemGroup[];
};

export const clearItemGroups = () => {
  db.prepare('DELETE FROM item_groups').run();
};
