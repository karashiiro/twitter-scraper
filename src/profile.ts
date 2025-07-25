import { requestApi, RequestApiResult } from './api';
import { TwitterAuth } from './auth';
import { TwitterApiErrorRaw } from './errors';
import { apiRequestFactory } from './api-data';

export interface CoreUserRaw {
  created_at?: string;
  name?: string;
  screen_name?: string;
}

export interface LegacyUserRaw {
  created_at?: string;
  description?: string;
  entities?: {
    url?: {
      urls?: {
        expanded_url?: string;
      }[];
    };
  };
  favourites_count?: number;
  followers_count?: number;
  friends_count?: number;
  media_count?: number;
  statuses_count?: number;
  id_str?: string;
  listed_count?: number;
  name?: string;
  location?: string;
  geo_enabled?: boolean;
  pinned_tweet_ids_str?: string[];
  profile_background_color?: string;
  profile_banner_url?: string;
  profile_image_url_https?: string;
  protected?: boolean;
  screen_name?: string;
  verified?: boolean;
  has_custom_timelines?: boolean;
  has_extended_profile?: boolean;
  url?: string;
  can_dm?: boolean;
}

/**
 * A parsed profile object.
 */
export interface Profile {
  avatar?: string;
  banner?: string;
  biography?: string;
  birthday?: string;
  followersCount?: number;
  followingCount?: number;
  friendsCount?: number;
  mediaCount?: number;
  statusesCount?: number;
  isPrivate?: boolean;
  isVerified?: boolean;
  isBlueVerified?: boolean;
  joined?: Date;
  likesCount?: number;
  listedCount?: number;
  location?: string;
  name?: string;
  pinnedTweetIds?: string[];
  tweetsCount?: number;
  url?: string;
  userId?: string;
  username?: string;
  website?: string;
  canDm?: boolean;
}

export interface UserRaw {
  data: {
    user: {
      result: {
        rest_id?: string;
        is_blue_verified?: boolean;
        legacy: LegacyUserRaw;
        core?: CoreUserRaw;
        avatar?: {
          image_url?: string;
        };
        location?: {
          location?: string;
        };
      };
    };
  };
  errors?: TwitterApiErrorRaw[];
}

function getAvatarOriginalSizeUrl(avatarUrl: string | undefined) {
  return avatarUrl ? avatarUrl.replace('_normal', '') : undefined;
}

export function parseProfile(
  legacy: LegacyUserRaw,
  isBlueVerified?: boolean,
): Profile {
  const profile: Profile = {
    avatar: getAvatarOriginalSizeUrl(legacy.profile_image_url_https),
    banner: legacy.profile_banner_url,
    biography: legacy.description,
    followersCount: legacy.followers_count,
    followingCount: legacy.friends_count,
    friendsCount: legacy.friends_count,
    mediaCount: legacy.media_count,
    isPrivate: legacy.protected ?? false,
    isVerified: legacy.verified,
    likesCount: legacy.favourites_count,
    listedCount: legacy.listed_count,
    location: legacy.location,
    name: legacy.name,
    pinnedTweetIds: legacy.pinned_tweet_ids_str,
    tweetsCount: legacy.statuses_count,
    url: `https://x.com/${legacy.screen_name}`,
    userId: legacy.id_str,
    username: legacy.screen_name,
    isBlueVerified: isBlueVerified ?? false,
    canDm: legacy.can_dm,
  };

  if (legacy.created_at != null) {
    profile.joined = new Date(Date.parse(legacy.created_at));
  }

  const urls = legacy.entities?.url?.urls;
  if (urls?.length != null && urls?.length > 0) {
    profile.website = urls[0].expanded_url;
  }

  return profile;
}

export async function getProfile(
  username: string,
  auth: TwitterAuth,
): Promise<RequestApiResult<Profile>> {
  const request = apiRequestFactory.createUserByScreenNameRequest();
  request.variables.screen_name = username;
  request.variables.withSafetyModeUserFields = true;
  request.features.hidden_profile_subscriptions_enabled = false; // Auth-restricted
  request.fieldToggles.withAuxiliaryUserLabels = false;

  const res = await requestApi<UserRaw>(request.toRequestUrl(), auth);
  if (!res.success) {
    return res;
  }

  const { value } = res;
  const { errors } = value;
  if (errors != null && errors.length > 0) {
    return {
      success: false,
      err: new Error(errors[0].message),
    };
  }

  if (!value.data || !value.data.user || !value.data.user.result) {
    return {
      success: false,
      err: new Error('User not found.'),
    };
  }
  const { result: user } = value.data.user;
  const { legacy } = user;

  if (user.rest_id == null || user.rest_id.length === 0) {
    return {
      success: false,
      err: new Error('rest_id not found.'),
    };
  }

  legacy.id_str = user.rest_id;
  legacy.screen_name ??= user.core?.screen_name;
  legacy.profile_image_url_https ??= user.avatar?.image_url;
  legacy.created_at ??= user.core?.created_at;
  legacy.location ??= user.location?.location;
  legacy.name ??= user.core?.name;

  if (legacy.screen_name == null || legacy.screen_name.length === 0) {
    return {
      success: false,
      err: new Error(`User ${username} does not exist or is private.`),
    };
  }

  return {
    success: true,
    value: parseProfile(legacy, user.is_blue_verified),
  };
}

const idCache = new Map<string, string>();

export async function getUserIdByScreenName(
  screenName: string,
  auth: TwitterAuth,
): Promise<RequestApiResult<string>> {
  const cached = idCache.get(screenName);
  if (cached != null) {
    return { success: true, value: cached };
  }

  const profileRes = await getProfile(screenName, auth);
  if (!profileRes.success) {
    return profileRes;
  }

  const profile = profileRes.value;
  if (profile.userId != null) {
    idCache.set(screenName, profile.userId);

    return {
      success: true,
      value: profile.userId,
    };
  }

  return {
    success: false,
    err: new Error('User ID is undefined.'),
  };
}
