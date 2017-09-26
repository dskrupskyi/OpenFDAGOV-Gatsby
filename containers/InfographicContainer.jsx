/* @flow */

import React from 'react'

import SideBar from '../components/SideBar'
import Infographic from '../components/Infographic'
import InfographicExplorer from '../components/InfographicExplorer'
import xhrGET from '../utils/xhr'
import { API_LINK } from '../constants/api'

type tSTATE = {
  countParam: string;
  current: Object;
  data: ?Object;
  filters: Object;
  infographics: Object;
  matchingRecords: number;
  nextCountParam: string;
  nextSearchParam: string;
  query: string;
  recordsTotal: number;
  searchParam: string;
  selected: string;
  type: string;
};

class InfographicContainer extends React.Component {
  static displayName = 'containers/InfographicContainer';

  // flow doesn't believe Component
  // has a state property unless you
  // explicitly define one for some reason
  state: tSTATE = {
    countParam: '',
    current: {},
    data: null,
    dateContraint: '',
    infographics: {},
    filters: {},
    matchingRecords: 0,
    nextCountParam: '',
    nextSearchParam: '',
    // the complete query string
    // the base api url + search + count
    query: '',
    // total records matching base query, no search
    recordsTotal: 0,
    // search parameter for query
    // ie, the radio buttons or the infoExplorer search field
    searchParam: '',
    // mark the selected menu item
    selected: '',
    // type of infographic to render
    type: 'Line',
  };

  defaultProps: Object = {
    infographics: [{}],
  };

  constructor (props: Object) {
    super(props)

    // by default the first explorer is active
    const current: Object = props.infographics[0]

    // countParam === count field for current explorer
    // modified by infoExplorer count field
    this.state.countParam = current.countParam
    // current (first) explorer
    this.state.current = current
    // for highlighting the current infographic in the menu
    this.state.selected = current.short
    // useful for updating, using the filter value as the key
    this.state.infographics = this._getInfographicMap(props.infographics)
    // current explorer (currently selected sidebar option)
    this.state.filters = current.filters
    // added for updating search via typing
    this.state.nextSearchParam = ''
    // added for updating count via typing
    this.state.nextCountParam = current.countParam
  }

  componentDidMount () {
    // fetch actual data for render
    this._fetchQueryAndUpdate('', this.state.nextCountParam)
  }

  /**
   * @description [array of explorer data from constructor]
   * @param  {Object} infographics [original infographics array]
   * @return {Object} [explorer map with short titles as key]
   */
  _getInfographicMap (infographics: Array<Object>): Object {
    const map: Object = {}

    if (infographics) {
      infographics.forEach(d => {
        map[d.short] = d
      })
    }

    return map
  }

  /**
   * @description [search param passed in from fetch]
   * @param {string} param [searchParam string]
   * @param {string} range [range generated by this._getFilterRange]
   * @returns {string} [final search= string for the query]
   */
  _getFilterSearch (param: string, range: string): string {
    // searchParam + range || searchParam || ''
    // if no need to filter just use raw searchParam IF available, else nothing
    let search: string = param ? `search=${param}&` : ''
    // if we explicitly need to filter date ranges for this endpoint
    // then we always include the range, but still check for whether
    // we need the searchParam or not
    // sorry this is complicated
    if (this.state.current.dateConstraint) {
      search = param ? `search=${range}+AND+${param}&` : `search=${range}&`
    }

    return search
  }

  /**
   * @description [takes in data from download.json]
   *              [makes sure we filter our infographic]
   *              [with a correct date-range, with the right filter]
   * @param  {Object} data [dataset data from downloads.json]
   * @return {string} [filter range or '']
   */
  _getFilterRange (data: Object): string {
    const curr: Object = this.state.current
    // first date of data by endpoint, from _meta.yaml
    const startDate: string = this.props.meta.start
    // search up to the last time we updated an openfda dataset
    const endDate: string = data.meta.last_updated.replace(/-+/g, '')

    // sometimes we want to filter by year, and sometimes we don't
    return curr.dateConstraint ?
      `${curr.dateConstraint}:[${startDate}+TO+${endDate}]` :
      ''
  }

  /**
   * @description [makes multiple requests to get all api data]
   *              [which seems excessive. goes in order like so]
   *              [
   *                downloads (dataset start/end) =>
     *              records (current and total record counts) =>
     *              final query (data for rendering infographics)
     *            ]
   * @param {string} [searchParam] [search= parameter]
   * @param {string} [countParam] [count= parameter]
   * @returns {Promise} [like all async methods, returns a promise]
   */
  _fetchQueryAndUpdate (searchParam: string, countParam: string) {
    const _handleQueryResponse = data => {
      this.setState({
        data,
      })
    }

    const _handleRecordsResponse = recordsData => {
      const recordsTotal: number = recordsData.meta.results.total

      // Get total number of records on the first call
      // matching will always === total records first time
      if (this.state.recordsTotal === 0) {
        this.setState({
          matchingRecords: recordsTotal,
          recordsTotal,
        })
      }
      // else we're filtering via search
      else if (this.state.searchParam !== searchParam) {
        this.setState({
          matchingRecords: recordsTotal,
        })
      }

      // has to be here because async
      // don't want to set searchParam and then do
      // the above check, we'd never update
      this.setState({
        // for to update the selected radio, query field, etc
        searchParam,
      })
    }

    const _handleDownloadResponse = downloadData => {
      // drug/event or whatever
      const endpoint: string = this.props.meta.api_path
      // search range to help filter out bunk data
      // or nothing, if we don't filter this query
      // see _explorers yaml for this endpoint
      const range: string = this._getFilterRange(downloadData)
      // complete search field. with or without range
      const search: string = this._getFilterSearch(searchParam, range)
      // the entire query, api endpoint + search params + count params
      const query: string = API_LINK + `${endpoint}.json?${search}count=${countParam}`

      // results data is unfortunately not included when filtering
      // by count params, so we need to make an additional request
      // to update records only when searchParams change

      // the entire query, api endpoint + search params
      // we do not want to include count parameters when counting total records
      const recordsQuery: string = API_LINK + `${endpoint}.json?${search}`

      this.setState({
        // update the count param
        countParam,
        // update complete string for current query field
        query,
        // what type of chart to render
        // we default to greater specificity (ie, defined by field)
        // but we also fall back to the current explorer default
        type: this.props.fieldsFlattened[countParam] || this.state.current.type,
      })

      xhrGET(recordsQuery, _handleRecordsResponse)
      xhrGET(query, _handleQueryResponse)
    }

    // 2 ways to get last updated date
    // query downloads.json and find the key that matches your endpoint
    // or make a request, check the meta of that request, and then
    // make another request with the date in the search field
    // i prefer to just make the download request (which gets cached anyway)
    let download_link = API_LINK + '/download.json'
    xhrGET(download_link, _handleDownloadResponse)
  }

  /**
   * @description [when typing in search field in info explorer
   * @param  {string|Object} e [an event object, or the string value]
   * @return {void} [update state]
   */
  _onSearchChange (e: string|Object) {
    const nextSearchParam: string = typeof e === 'string' ? e : e.target.value

    this.setState({
      nextSearchParam,
    })
  }

  /**
   * @description [any interaction that updates the count param]
   * @param  {string|Object} e [an event object]
   * @return {void} [update state]
   */
  _onCountChange (e: Object) {
    this.setState({
      countParam: e.target.value,
    })
  }

  /**
   * @description [info explorer count update method]
   * @param  {Object} e [an event object]
   * @return {void} [update state, then fetch new query]
   */
  _onCountChangeAndUpdate (e: Object) {
    this._onCountChange(e)
    this._update(this.state.searchParam, e.target.value)
  }

  /**
   * @description [callback when typing into an infoExplorer field]
   * @param  {Object} e [an event object]
   * @return {void} [update state, then fetch new query]
   */
  _onKeyPress (e: Object) {
    const code: number = e.keyCode ? e.keyCode : e.which

    // Handle space character (don't allow it)
    if (code === 32 || code === 13) {
      if (e.preventDefault) {
        e.preventDefault()
      }
      else {
        e.returnValue = false
      }
    }

    // Handle return keypress
    if (code === 13) {
      this._update()
    }
  }

  /**
   * @description [used to update on select change or on enter click]
   * @param  {string} nextSearch?: string        [description]
   * @param  {string} nextCount?:  string        [description]
   * @return {void} [just updates state, the fetches the query]
   */
  _update (nextSearch?: string, nextCount?: string) {
    let nextSearchParam: string = this.state.nextSearchParam

    if (typeof nextSearch === 'string') {
      nextSearchParam = nextSearch
    }

    let nextCountParam: string = this.state.countParam

    if (typeof nextCount === 'string') {
      nextCountParam = nextCount
    }
    else if (typeof nextCount !== 'undefined') {
      nextCountParam = nextCount.target.value
    }

    this.setState({
      nextCountParam,
      nextSearchParam,
    })

    this._fetchQueryAndUpdate(nextSearchParam, nextCountParam)
  }

  /**
   * @description [updates the x records match string just below info filters]
   * @param {Array<Object>} results [results count + meta data]
   * @return {void|number} [nothing if failed query, else reduced count]
   */
  _getCurrRecords (results: Array<Object>): void|number {
    if (!results) return

    return results
      .map(result => result.count)
      .reduce((a, b) => a + b)
  }

  /**
   * @description onClick handler for the explore the data sidebar
   * @param  {Object} e [event object]
   * @return {void} [just updates state]
   */
  _sidebarToggle (e: Object) {
    if (!e) return

    const current: string = e.target.value ?
      e.target.value :
      e.target.textContent

    this.setState({
      // explorer object
      current: this.state.infographics[current],
      // text value, for menu select
      selected: current,
    })

    // Update the infographic
    const nextSearchParam: string = this.state.infographics[current].filters[0].searchParam
    const nextCountParam: string = this.state.infographics[current].countParam
    this._update(nextSearchParam, nextCountParam)
  }

  render (): ?React.Element {
    if (!this.state.data) return <span />

    // pull out keys for sidebarMenu
    const infographicKeys: Array<string> = Object.keys(this.state.infographics)

    return (
      <div className='flex-box'>
        <SideBar
          menu={{
            // for pulling out explorer buttons
            data: infographicKeys,
            // update which infographic we're looking at
            handler: this._sidebarToggle.bind(this),
            // the current active infographic
            selected: this.state.selected,
            // sidebar header
            title: 'Explore the data',
          }}
        />
        <section className='float-r infographic-container'>
          <Infographic
            { ...this.props }
            { ...this.state }
            onSearchChange={this._update.bind(this)}
            records={this.state.matchingRecords}
          />
          <div className='m-hide'>
            <InfographicExplorer
              { ...this.props }
              { ...this.state }
              onKeyPress={this._onKeyPress.bind(this)}
              onSearchChange={this._onSearchChange.bind(this)}
              onCountChange={this._onCountChange.bind(this)}
              onCountChangeAndUpdate={this._onCountChangeAndUpdate.bind(this)}
            />
          </div>
        </section>
      </div>
    )
  }
}

export default InfographicContainer
