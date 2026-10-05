import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { ActiveSpawn } from './spawns';

export type MainTabParamList = {
  Map: undefined;
  Inventory: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Capture: { spawn: ActiveSpawn };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MapScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Map'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type InventoryScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Inventory'>,
  NativeStackScreenProps<RootStackParamList>
>;
