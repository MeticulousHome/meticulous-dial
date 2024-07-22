import { APIError, LastProfileIdent } from 'meticulous-api';
import { Profile } from 'meticulous-typescript-profile';
import { api } from './api';
import { profiles } from '../../src/data/defaultProfiles';
import { ProfileValue } from '../../src/components/store/features/preset/preset-slice';

const loadDefaultProfilesMock = (): Promise<ProfileValue[]> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(profiles);
    }, 2000);
  });

export const getDefaultProfiles = async () => {
  try {
    // TODO: change logic to fetch profiles from api
    const profilesData = await loadDefaultProfilesMock();
    return profilesData;
  } catch (error) {
    console.error('GetProfiles error: ', error);
    return [];
  }
};

export const getProfiles = async () => {
  try {
    const { data } = await api.fetchAllProfiles();
    return data as Profile[] | APIError;
  } catch (error) {
    console.error('GetProfiles error: ', error);
  }
};

export const saveProfile = async (body: Profile) => {
  try {
    const { data } = await api.saveProfile(body);
    return data;
  } catch (error) {
    console.error('SaveProfile error: ', error);
  }
};

export const deleteProfile = async (id: string) => {
  try {
    const { data } = await api.deleteProfile(id);
    return data;
  } catch (error) {
    console.error('DeleteProfile error: ', error);
  }
};

export const loadProfileData = async (body: Profile) => {
  try {
    const { data } = await api.loadProfileFromJSON(body);
    return data;
  } catch (error) {
    console.error('LoadProfileData error: ', error);
  }
};

export const startProfile = async () => {
  try {
    const { data } = await api.executeAction('start');
    return data;
  } catch (error) {
    console.error('Start profile error: ', error);
  }
};

export const getLastProfile = async () => {
  try {
    const { data } = await api.getLastProfile();
    return data as LastProfileIdent;
  } catch (error) {
    console.error('Get last Profile error: ', error);
  }
};

export const getProfileDefaultImages = async (): Promise<string[]> => {
  try {
    const { data } = await api.getProfileDefaultImages();
    return data as string[];
  } catch (error) {
    console.error('Get Profile Default Images error: ', error);
    return [];
  }
};

export const getProfileImage = async (imageId: string) => {
  try {
    const { data } = await api.getProfileImage(imageId);
    return data;
  } catch (error) {
    console.error('Get Profile Default Images error: ', error);
  }
};
