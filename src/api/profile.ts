import { APIError, LastProfileIdent } from '@meticulous-home/espresso-api';
import { Profile } from '@meticulous-home/espresso-profile';
import { api } from './api';

export const getDefaultProfiles = async (): Promise<Profile[]> => {
  try {
    const { data } = await api.getDefaultProfiles();
    return data as Profile[];
  } catch (error) {
    console.error('GetDefaultProfiles error: ', error.message);
    return [];
  }
};

export const getProfiles = async () => {
  try {
    const { data } = await api.fetchAllProfiles();
    return data as Profile[] | APIError;
  } catch (error) {
    console.error('GetProfiles error: ', error.message);
  }
};

export const saveProfile = async (body: Profile) => {
  try {
    const { data } = await api.saveProfile(body);
    return data;
  } catch (error) {
    console.error('SaveProfile error: ', error.message);
  }
};

export const deleteProfile = async (id: string) => {
  try {
    const { data } = await api.deleteProfile(id);
    return data;
  } catch (error) {
    console.error('DeleteProfile error: ', error.message);
  }
};

export const loadProfileData = async (body: Profile) => {
  try {
    const { data } = await api.loadProfileFromJSON(body);
    return data;
  } catch (error) {
    console.error('LoadProfileData error: ', error.message);
  }
};

export const startProfile = async () => {
  try {
    const { data } = await api.executeAction('start');
    return data;
  } catch (error) {
    console.error('Start profile error: ', error.message);
  }
};

export const getLastProfile = async () => {
  try {
    const { data } = await api.getLastProfile();
    return data as LastProfileIdent;
  } catch (error) {
    console.error('Get last Profile error: ', error.message);
  }
};

export const getProfileDefaultImages = async (): Promise<string[]> => {
  try {
    const { data } = await api.getProfileDefaultImages();
    return data as string[];
  } catch (error) {
    console.error('Get Profile Default Images error: ', error.message);
    return [];
  }
};

export const getProfileImage = async (imageId: string) => {
  try {
    const { data } = await api.getProfileImage(imageId);
    return data;
  } catch (error) {
    console.error('Get Profile Default Images error: ', error.message);
  }
};
