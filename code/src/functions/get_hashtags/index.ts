import {publicSDK } from '@devrev/typescript-sdk';
import * as gplay from "google-play-scraper";
import { ApiUtils, HTTPResponse } from './utils';
import {LLMUtils} from './llm_utils';
import { error } from 'console';
const axios = require('axios');
require('dotenv').config();



export const run = async (events: any[]) => {
  for (const event of events) {
    const endpoint: string = event.execution_metadata.devrev_endpoint;
    const token: string = event.context.secrets.service_account_token;
    const fireWorksApiKey: string = event.input_data.keyrings.fireworks_api_key;
    const apiUtil: ApiUtils = new ApiUtils(endpoint, token);
    // Get the number of reviews to fetch from command args.
    const snapInId = event.context.snap_in_id;
    const inputs = event.input_data.global_values;
    let parameters:string = event.payload.parameters.trim();
    const tags = event.input_data.resources.tags;
    const llmUtil: LLMUtils = new LLMUtils(fireWorksApiKey, `accounts/fireworks/models/${inputs['llm_model_to_use']}`, 200);

    
    var username: string = '';
    let postResp: HTTPResponse = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, `Parameters provided ${parameters}`, 1); 

    if (typeof parameters === 'string' && parameters !== 'help') {
      username = parameters;
      let postResp: HTTPResponse = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, `Parameters provided ${username}`, 1); 
    }
    const userInfo = {
      method: 'GET',
      url: 'https://twitter154.p.rapidapi.com/user/details',
      params: { username: username },
      headers: {
        'X-RapidAPI-Key': process.env['RAPIDAPI_KEY'],
        'X-RapidAPI-Host': process.env['RAPIDAPI_HOST']
      }
    };

    try {
      const userDetails = await axios.request(userInfo);
      let postResp1: HTTPResponse = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, `User details fetched ${username}`, 1); 

      var userLocation = userDetails.location;

      let postResp: HTTPResponse = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, `User location fetched ${userLocation}`, 1); 

    } catch (error) {
      console.error(error);
    }


    const availableTrends = {
      method: 'GET',
      url: 'https://twitter154.p.rapidapi.com/trends/available',
      headers: {
        'X-RapidAPI-Key': process.env['RAPIDAPI_KEY'],
        'X-RapidAPI-Host': process.env['RAPIDAPI_HOST']
      }
    }

    try {
      const response = await axios.request(availableTrends);
      const trendingList = response.data;
      const countriesList =  trendingList.filter((item: { country: any; }) => item.country);
      const countryToWOEIDMap = countriesList.reduce((map: { [x: string]: number; }, item: { country: string | number; }) => (map[item.country] = 1, map), {});
      console.log(countryToWOEIDMap);
      var userWoeid = 1;
      if (userLocation && userLocation in countryToWOEIDMap) {
        userWoeid = countryToWOEIDMap[userLocation];
      }

    } catch (error) {
      console.error(error);
    }

    const hashtagRequest = {
      method: 'GET',
      url: 'https://twitter154.p.rapidapi.com/trends/?woeid=3369',
      headers: {
        'X-RapidAPI-Host': 'twitter154.p.rapidapi.com',
        'X-RapidAPI-Key': '16bab69374mshcb1b27ff71d944ep1507ccjsn7d4e5c5edec4'
      }
    };
    try{
        const hashtagResponse = axios.request(hashtagRequest);
        const trendsList = hashtagResponse[0].trends;
        // Extract top 5 trend names
        var top5TrendNames = trendsList.slice(0, 5).map((trend: { name: any; }) => trend.name);
       console.log(top5TrendNames);
       const postTicketResp: HTTPResponse  = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, top5TrendNames, 1);
    }
    catch(error){
      console.log(error)
    }



      // const systemPrompt = `You are an expert at analyzing a given phrase of three/four words and generating a short trendy caption/tweet using individual words of that phrase. You are given a phrase of about three/four words provided by a user for the app ${inputs['app_id']}. The input given to you is ${username}. You have to generate a JSON output with fields "text" of type string and "hashtags" of type array of strings. The "text" field should be a small catchy tweet or caption related to ${username} provided by user as input. The "hashtags" field should be three to four proper hashtags in an array that fits the text field that is generated`;
      // const humanPrompt = ``;

      // let llmResponse: Object = {};
      // try {
      //   llmResponse = await llmUtil.chatCompletion(systemPrompt, humanPrompt, {username});
      //   console.log((llmResponse as any).text, 'llm response');
      //   let postResp = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, `Creating ticket for review: ${(llmResponse as any).text}`, 1);
      // } catch (err) {
      //   console.error(`Error while calling LLM: ${err}`);
      // }

      const createTicketResp = await apiUtil.createTicket({
        title: 'generate hashtags',
        tags: [{id: tags['generate_hashtags'].id}],
        body: `${(top5TrendNames as any)}`,
        type: publicSDK.WorkType.Ticket,
        owned_by: [inputs['default_owner_id']],
        applies_to_part: inputs['default_part_id'],
      });
      if (!createTicketResp.success) {
        console.error(`Error while creating ticket: ${createTicketResp.message}`);
        continue;
      }

      // Post a message with ticket ID.
      else{
      const ticketID = createTicketResp.data.work.id;
      const ticketCreatedMessage = `Created ticket successfully with id : <${ticketID}>`;
      const postTicketResp: HTTPResponse  = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, ticketCreatedMessage, 1);
      if (!postTicketResp.success) {
        console.error(`Error while creating timeline entry: ${postTicketResp.message}`);
        continue;
      }
    }
  }
}

export default run;
