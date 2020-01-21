import React, { Component } from 'react';
import { log } from '@ohif/core';
import PropTypes from 'prop-types';
import qs from 'querystring';

import ConnectedViewerRetrieveStudyData from '../connectedComponents/ConnectedViewerRetrieveStudyData';
import NotFound from '../routes/NotFound';

class StandaloneRouting extends Component {
  state = {
    studies: null,
    server: null,
    studyInstanceUids: null,
    seriesInstanceUids: null,
    error: null,
    loading: true,
  };

  static propTypes = {
    location: PropTypes.object,
    store: PropTypes.object,
  };

  static parseQueryAndRetrieveDICOMWebData(query) {
    return new Promise((resolve, reject) => {
      const url = query.url;

      if (!url) {
        return reject(new Error('No URL was specified. Use ?url=$yourURL'));
      }

      // Define a request to the server to retrieve the study data
      // as JSON, given a URL that was in the Route
      const oReq = new XMLHttpRequest();

      // Add event listeners for request failure
      oReq.addEventListener('error', error => {
        log.warn('An error occurred while retrieving the JSON data');
        reject(error);
      });

      // When the JSON has been returned, parse it into a JavaScript Object
      // and render the OHIF Viewer with this data
      oReq.addEventListener('load', event => {
        if (event.target.status === 404) {
          reject(new Error('No JSON data found'));
        }

        // Parse the response content
        // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseText
        if (!oReq.responseText) {
          log.warn('Response was undefined');
          reject(new Error('Response was undefined'));
        }

        log.info(JSON.stringify(oReq.responseText, null, 2));

        const data = JSON.parse(oReq.responseText);
        if (data.servers) {
          if (!query.studyInstanceUids) {
            log.warn('No study instance uids specified');
            reject(new Error('No study instance uids specified'));
          }

          const server = data.servers.dicomWeb[0];
          server.type = 'dicomWeb';

          const studyInstanceUids = query.studyInstanceUids.split(';');
          const seriesInstanceUids = query.seriesInstanceUids ? query.seriesInstanceUids.split(';') : [];

          resolve({ server, studyInstanceUids, seriesInstanceUids });
        } else {
          resolve({ studies: data.studies, studyInstanceUids: [] });
        }
      });

      // Open the Request to the server for the JSON data
      // In this case we have a server-side route called /api/
      // which responds to GET requests with the study data
      log.info(`Sending Request to: ${url}`);
      oReq.open('GET', url);
      oReq.setRequestHeader('Accept', 'application/json');

      // Fire the request to the server
      oReq.send();
    });
  }

  async componentDidMount() {
    try {
      let { search } = this.props.location;

      // Remove ? prefix which is included for some reason
      search = search.slice(1, search.length);
      const query = qs.parse(search);

      const {
        server,
        studies,
        studyInstanceUids,
        seriesInstanceUids,
      } = await StandaloneRouting.parseQueryAndRetrieveDICOMWebData(query);

      this.setState({
        studies,
        server,
        studyInstanceUids,
        seriesInstanceUids,
        loading: false,
      });
    } catch (error) {
      this.setState({ error: error.message, loading: false });
    }
  }

  render() {
    const message = this.state.error ? `Error: ${JSON.stringify(this.state.error)}` : 'Loading...';
    if (this.state.error || this.state.loading) {
      return <NotFound message={message} showGoBackButton={this.state.error} />;
    }

    return (
      <ConnectedViewerRetrieveStudyData
        studies={this.state.studies}
        studyInstanceUids={this.state.studyInstanceUids}
        seriesInstanceUids={this.state.seriesInstanceUids}
        server={this.state.server}
      />
    );
  }
}

export default StandaloneRouting;
