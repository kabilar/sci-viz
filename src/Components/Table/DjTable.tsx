import React from 'react'
import { Card, Table } from 'antd'
import type { FilterValue } from 'antd/es/table/interface'
import { Redirect } from 'react-router-dom'

interface RestrictionStore {
  [key: string]: Array<string>
}

interface DjTableProps {
  token: string
  route: string
  name: string
  height: number
  restrictionList: Array<string>
  link?: string
  updatePageStore: (key: string, record: Array<string>) => void
  channel?: string
  channelList?: Array<string>
  store?: RestrictionStore
}

interface DjTableState {
  data: djRecords
  dataAttributes: djAttributes
  numberOfTuples: number
  offset: number
  filter: Array<string>
  sorter: Array<string>
  keys: Array<string> | undefined
  selectedRow: Array<number>
}

interface djAttributesArray {
  [index: number]: string
  name: string
  type: string
  nullable: boolean
  default: string
  autoincriment: boolean
}
interface djAttributes {
  attributeHeaders: Array<string>
  attributes: {
    primary: Array<djAttributesArray>
    secondary: Array<djAttributesArray>
  }
  unique_values: Array<Array<number | null | bigint | boolean | string>>
}

interface djRecords {
  recordHeader: Array<string>
  records: Array<Array<number | null | bigint | boolean | string>>
  totalCount: number
}

/**
 * DjTable component
 */
export default class DjTable extends React.Component<
  DjTableProps,
  DjTableState
> {
  constructor(props: DjTableProps) {
    super(props)
    this.state = {
      data: { recordHeader: [], records: [[]], totalCount: 0 },
      dataAttributes: {
        attributeHeaders: [],
        attributes: { primary: [], secondary: [] },
        unique_values: [[]],
      },
      numberOfTuples: 5, //limit
      offset: 1, //offset
      filter: [],
      sorter: [],
      keys: undefined,
      selectedRow: [0],
    }

    this.getRecords = this.getRecords.bind(this)
    this.getAttributes = this.getAttributes.bind(this)
    this.compileTable = this.compileTable.bind(this)
    this.redirect = this.redirect.bind(this)
  }

  handleChange(
    pagination: any,
    filters: Record<string, FilterValue | null>,
    sorter: any
  ) {
    let filter = []

    let isFilterNull = true

    for (const key in filters) {
      if (filters[key] !== null) {
        filter.push(`&${key}=${filters[key]}`)
        isFilterNull = false
      }
    }

    let sorterArr = []

    let isSorterNull = true

    if (sorter['order'] !== null && sorter['field'] !== null) {
      isSorterNull = false
      let sort = ''
      if (sorter['order'] == 'ascend') {
        sort = 'ASC'
      } else if (sorter['order'] == 'descend') {
        sort = 'DESC'
      }
      sorterArr.push(`${sorter['field']} ${sort}`)
    }

    let offset = pagination.current

    if (isFilterNull) {
      this.setState({ offset: offset, filter: [] })
    } else {
      this.setState({ offset: offset, filter: filter })
    }

    if (isSorterNull) {
      this.setState({ offset: offset })
    } else {
      this.setState({ offset: offset, sorter: sorterArr })
    }
  }

  getRecords(): Promise<djRecords> {
    let queryParamList = [...this.props.restrictionList]
    let channelCheckArr = Array<boolean>()

    this.props.channelList?.forEach((element) => {
      if (this.props.store![element]) {
        channelCheckArr.push(true)
      } else {
        channelCheckArr.push(false)
      }
    })

    if (
      this.props.restrictionList.includes('') &&
      channelCheckArr.includes(false)
    ) {
      let arr = Array<string>()
      let arrRec = Array<Array<number | null | bigint | boolean | string>>()

      return Promise.resolve({
        recordHeader: arr,
        records: arrRec,
        totalCount: 0,
      })
    }

    for (let i in this.props.channelList) {
      if (typeof this.props.store![this.props.channelList[+i]] != undefined) {
        queryParamList = queryParamList.concat(
          this.props.store![this.props.channelList[+i]]
        )
      }
    }
    if (queryParamList.indexOf('') !== -1) {
      queryParamList.splice(queryParamList.indexOf(''), 1)
    }

    let apiUrl =
      `${process.env.REACT_APP_DJSCIVIZ_BACKEND_PREFIX}` + this.props.route

    if (
      !this.state.sorter.join(',').includes('ASC') &&
      !this.state.sorter.join(',').includes('DESC')
    ) {
      apiUrl =
        apiUrl +
        '?page=' +
        this.state.offset +
        '&limit=' +
        this.state.numberOfTuples
    } else {
      apiUrl =
        apiUrl +
        '?page=' +
        this.state.offset +
        '&limit=' +
        this.state.numberOfTuples +
        '&order=' +
        this.state.sorter.join(',')
    }

    if (this.props.restrictionList.length > 0) {
      apiUrl = apiUrl + '&' + this.props.restrictionList.join('&')
    }

    apiUrl = apiUrl.concat('&')

    apiUrl = apiUrl + queryParamList.join('&')

    if (this.state.filter.length !== 0) {
      for (const key of this.state.filter) {
        apiUrl = apiUrl + key
      }
    }
    return fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + this.props.token,
      },
    })
      .then((result) => {
        return result.json()
      })
      .then((result) => {
        return result as Promise<djRecords>
      })
  }

  getAttributes(): Promise<djAttributes> {
    let apiUrlAttr =
      `${process.env.REACT_APP_DJSCIVIZ_BACKEND_PREFIX}` +
      this.props.route +
      '/attributes'
    return fetch(apiUrlAttr, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + this.props.token,
      },
    })
      .then((result) => {
        return result.json()
      })
      .then((result) => {
        return result as Promise<djAttributes>
      })
  }

  componentDidMount() {
    this.getRecords()
      .then((result) => {
        this.setState({ data: result })
      })
      .then(() => {
        return this.getAttributes()
      })
      .then((result) => {
        this.setState({ dataAttributes: result })

        let pks: string[] = []

        this.state.dataAttributes.attributes.primary.map(
          (value: any, index: number) => {
            pks.push(value[0])
          }
        )

        let record: string[] = []

        for (const val in this.state.data.records) {
          pks.forEach((value: any, index: any) => {
            //this works because i assume the primary keys are the first ones in this.state.data.recordHeader
            if (this.state.data.recordHeader[index] === value) {
              //might need revision
              record.push(`${value}=${this.state.data.records[val][index]}`)
            }
          })
        }

        this.props.updatePageStore(this.props.channel!, record.slice(0, 2))
      })
  }

  componentDidUpdate(prevProps: DjTableProps, prevState: DjTableState): void {
    if (
      prevState.offset !== this.state.offset ||
      this.state.filter !== prevState.filter ||
      this.state.sorter !== prevState.sorter
    ) {
      this.getRecords().then((result) => {
        this.setState({ data: result })
      })
    }
    let propsUpdate = false
    if (this.props.store !== prevProps.store) {
      this.props.channelList?.forEach((element) => {
        if (
          JSON.stringify(this.props.store![element]) !==
          JSON.stringify(prevProps.store![element])
        ) {
          propsUpdate = true
        }
      })
    }
    if (propsUpdate) {
      this.getRecords().then((payload) => {
        this.setState({ data: payload })
        let pks: string[] = []
        this.state.dataAttributes.attributes.primary.map(
          (value: any, index: number) => {
            pks.push(value[0])
          }
        )

        let record: string[] = []

        for (const val in this.state.data.records) {
          pks.forEach((value: any, index: any) => {
            //this works because i assume the primary keys are the first ones in this.state.data.recordHeader
            if (this.state.data.recordHeader[index] === value) {
              //might need revision
              record.push(`${value}=${this.state.data.records[val][index]}`)
            }
          })
        }

        this.props.updatePageStore(this.props.channel!, record.slice(0, 2))
      })
    }
  }

  redirect() {
    let link = ''
    if (this.state.keys !== undefined) {
      this.state.keys.forEach(function (val, i, array) {
        link = link + '&' + val
      })
      return this.props.link ? (
        <Redirect to={{ pathname: `${this.props.link}?${link}` }} />
      ) : (
        console.log('Unable to link')
      )
    }
  }

  parseDate(dateTimeString: string) {
    // Handle case with null
    let microseconds = ''
    if (dateTimeString === null) {
      return '=NULL='
    }
    if ((parseFloat(dateTimeString) * 1000 + '').includes('.')) {
      microseconds = (parseFloat(dateTimeString) * 1000 + '').split('.')[1]
    }
    let date = new Date(parseFloat(dateTimeString) * 1000)
    return date
      .toUTCString()
      .replace(' GMT', '.' + date.getUTCMilliseconds() + microseconds + ' GMT')
  }

  compileTable() {
    // could make an interface for these
    let columns: Array<{}> = []
    let data: Array<{}> = []

    let fullAttr = this.state.dataAttributes.attributes.primary.concat(
      this.state.dataAttributes.attributes.secondary
    )

    fullAttr.map((value: djAttributesArray, index: number) => {
      value[1].includes('datetime') ||
      value[1] === 'time' ||
      value[1] === 'timestamp' ||
      value[1] === 'date'
        ? columns.push({
            title: value[0],
            dataIndex: value[0],
            filters: this.state.dataAttributes.unique_values[index],
            filterMultiple: false,
            sorter: {},
            render: (date: string) => this.parseDate(date),
          })
        : columns.push({
            title: value[0],
            dataIndex: value[0],
            filters: this.state.dataAttributes.unique_values[index],
            filterMultiple: false,
            sorter: {},
          })
    })
    this.state.data.records.map(
      (value: (string | number | bigint | boolean | null)[], index: number) => {
        let tmp: {} = { key: index }
        value.map(
          (value: string | number | bigint | boolean | null, index: number) => {
            Object.assign(tmp, { [this.state.data.recordHeader[index]]: value })
          }
        )
        data.push(tmp)
      }
    )
    return (
      <Table
        columns={columns}
        rowSelection={
          this.props.channel
            ? {
                selectedRowKeys: this.state.selectedRow,
                type: 'radio',
                onChange: (selectedRowKeys: any, selectedRows: any) => {
                  let record: string[] = []

                  let pks: any[] = []

                  this.state.dataAttributes.attributes.primary.map(
                    (value: any, index: number) => {
                      pks.push(value[0])
                    }
                  )

                  for (const val in selectedRows[0]) {
                    pks.forEach((value: any, index: any) => {
                      if (val !== 'key' && val === value) {
                        record.push(`${val}=${selectedRows[0][val.toString()]}`)
                      }
                    })
                  }

                  this.props.updatePageStore(this.props.channel!, record)

                  this.setState({ selectedRow: [...selectedRowKeys] })
                },
              }
            : undefined
        }
        dataSource={data}
        key={data.toString() + columns.toString()}
        onChange={this.handleChange.bind(this)}
        onRow={(record: any, rowIndex: number | undefined) => {
          return {
            onClick: (event) => {
              event.stopPropagation()
              let keysArr: string[] = []
              this.state.dataAttributes.attributes.primary.map(
                (value: any, index: number) => {
                  keysArr.push(`${value[0]}=${record[value[0]]}`)
                }
              )
              this.setState({ keys: keysArr })
            },
          }
        }}
        pagination={{
          total: this.state.data.totalCount,
          pageSize: this.state.numberOfTuples,
          current: this.state.offset,
        }}
      />
    )
  }

  render() {
    return (
      <Card
        style={{ width: '100%', height: this.props.height }}
        bodyStyle={{ height: '100%', overflowY: 'auto' }}
        hoverable={true}
      >
        <>
          {this.redirect()}
          {this.compileTable()}
        </>
      </Card>
    )
  }
}
