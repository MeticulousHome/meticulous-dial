import { APIError, LastProfileIdent } from 'meticulous-api';
import { Profile } from 'meticulous-typescript-profile';
import { api } from './api';

export const getProfiles = async () => {
  try {
    const { data } = await api.fetchAllProfiles();
    return data as Profile[] | APIError;
  } catch (error) {
    console.error('GetProfiles error: ', error);
  }
};

export const saveProfile = async (body: any) => {
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
