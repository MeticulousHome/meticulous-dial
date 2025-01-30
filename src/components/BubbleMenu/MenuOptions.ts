interface MenuBaseOption {
  type: string | 'default' | 'seperator' | 'image';
  visible?: boolean | (() => boolean);
  selectable?: boolean | (() => boolean);
}

interface MenuSelectableOption extends MenuBaseOption {
  type: 'default' | 'hold' | 'disabled';
  label: string | (() => string);
  onSelected?: () => void;
}

export type MenuOption = MenuBaseOption | MenuSelectableOption;
