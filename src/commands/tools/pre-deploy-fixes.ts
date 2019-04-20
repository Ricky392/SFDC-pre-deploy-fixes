// {
// 	"filters" : [
// 		{
// 			"name" : "ProfileFiltering",
// 			"description" :"Remove unwanted stuff in profiles",
// 			"folders": 		[
// 				"profiles"
// 			],
// 			"file_extensions":   [
// 				"profile"
// 			],
// 			"exclude_list" : [
// 				{ 
// 					"type_tag":"userPermissions",
// 					"identifier_tag" : "name",
// 					"values" : [
// 							"AllowUniversalSearch",
// 							"EnableNotifications"
// 					]
// 				},
// 				{
// 					"type_tag":"tabVisibilities",
// 					"identifier_tag" : "tab",
// 					"values" : [
// 							"TabExportScripts",
// 							"TabInstallScripts"
// 					]
// 				}
// 			]
// 		}
// 	]
// }


// THE CORRECT format

// {
//    "filters" : [
//    {
//      "ignore_metadata":   [
//        "applications/Sales.app",
//        "applications/Servizio.app",
//         "appMenus/*"				
//       ]
//    }
//   ],
// 
//   "default": {
//
//     "authproviders/*": {
//       "replace": {
//         "executionUser": "username@salesforce.com"
//       }
//     }
//
//
//
//     "workflows/Opportunity.workflow": [{
//       "where": "Workflow.alerts[* fullName=NOME_WORKFLOW1 | fullName=NOME_WORKFLOW2]",
//       "replace": {
//         "ccEmails": "a@a.it,b@b.it",
//         "recipients": [
//           {
//             "recipient": "test1@test1.it.full",
//             "type": "user"
//           },
//           {
//             "recipient": "test2@test2.it.full",
//             "type": "user"
//           }
//         ]
//       }
//     }],
//     "profiles/Profilo di esempio.profile" : [{
//       "where": "Profile",
//       "disablePermissions": ["ConvertLeads","OverrideForecasts","TransferAnyLead","ViewSetup"],
//       "disableObjects": ["Lead","Opportunity","OggettoCustom__c"]
//     }]    
//   }
// }




import { Command, flags } from '@oclif/command'
import { FILE } from 'dns'
//import { isArray } from '@salesforce/ts-types';

//import { format } from 'path';

export default class ExecuteFilter extends Command {
  static description = ``
  static examples = []

  static flags = {
    // flag with a value (-n, --name=VALUE)
    configFile: flags.string({ char: 'c', description: 'Config JSON file path' }),
    inputfolder: flags.string({ char: 'i', description: 'Input folder (default: "." )' }),
    outputfolder: flags.string({ char: 'o', description: 'Output folder (default: parentFolder + _xml_content_filtered)' })
  }

  static args = []

  static dummy = FILE

  // Input params properties
  configFile
  inputFolder
  outputFolder


  // Internal properties
  fs = require('fs')
  fse = require('fs-extra')
  xml2js = require('xml2js')
  util = require('util')
  path = require('path')
  jsonQuery = require('json-query')
  smmryUpdatedFiles = {}
  smmryResult = {filterResults: {}}

  // Runtime methods
  async run() {

    const { args, flags } = this.parse(ExecuteFilter)
    
    args
    // Get input arguments or default values
    this.configFile = flags.configFile || 'config/.pre-deploy-fixs.json'
    this.inputFolder = flags.inputfolder || 'force-app/main/default'
    this.outputFolder = flags.outputfolder || 'scripts/'+this.path.basename(this.inputFolder)+'PdfOut'
    this.log(`Initialize XML content filtering of ${this.inputFolder} ,using ${this.configFile} , into ${this.outputFolder}`)

    // Read json config file
    const filterConfig = this.fse.readJsonSync(this.configFile)
    console.log('Config file content:')
    console.log(this.util.inspect(filterConfig, false, null))

    // Create output folder/empty it if existing
    if (this.fs.existsSync(this.outputFolder)) {
      console.log('Empty output folder '+this.outputFolder)
      this.fse.emptyDirSync(this.outputFolder);
    }
    else {
      console.log('Create output folder '+this.outputFolder)
      this.fs.mkdirSync(this.outputFolder)
    }

    // Copy input folder to output folder
    console.log('Copy in output folder '+this.outputFolder)
    this.fse.copySync(this.inputFolder,this.outputFolder)

    // Browse filters
    console.log('\nIGNORING PART')
    let self = this
    if(filterConfig.filters != undefined){
      filterConfig.filters.forEach(function (filter) { 
        //console.log(filter.name+' ('+filter.description+')')
        // Browse filter folders
        filter.ignore_metadata.forEach(file => {
          console.log('FILE: '+file)
          // Browse folder files
          //const folderFiles = self.fs.readdirSync(self.outputFolder+'/'+file)
           // Build file name
           const fpath = file.replace(/\\/g, '/');
           //const browsedFileExtension = fpath.substring(fpath.lastIndexOf('.')+1);
           const browsedFolder = fpath.substring(0, fpath.lastIndexOf('/'));
           const browsedFile = fpath.substring(fpath.lastIndexOf('/')+1);
           if(browsedFile === '*'){        
            self.fse.emptyDir(self.outputFolder+'/'+browsedFolder)
           } else {
            self.fse.remove(self.outputFolder+'/'+fpath)
           } 
        })
      })
    }

    // Ciclo tutti i file restanti così da effettuare i P-D-F

    // Browse filters

    console.log('\nFIXING PART')

    Object.keys(filterConfig['default']).forEach(function (filter) { 
          // Browse filter folders
          console.log(filter)
          const fpath = filter.replace(/\\/g, '/');
          const browsedFolder = fpath.substring(0, fpath.lastIndexOf('/'));
          const browsedFile = fpath.substring(fpath.lastIndexOf('/')+1);

          if(browsedFile === '*'){                                    
            self.fse.readdirSync(self.outputFolder+'/'+browsedFolder).forEach(file => {
              const fullFilePath = self.outputFolder+'/'+browsedFolder+'/'+file;
              console.log('fix: '+file);            
              self.filterXmlFromFile(filterConfig['default'][filter],fullFilePath)  
            });                      
          } else {
            self.filterXmlFromFile(filterConfig['default'][filter],self.outputFolder+'/'+fpath)            
          }    
      })

    this.smmryResult.filterResults = this.smmryUpdatedFiles

    // Display results as JSON
    //console.log(JSON.stringify(this.smmryResult))


  }

  // Filter XML content of the file
  filterXmlFromFile(filter,file) {
    var parser = new this.xml2js.Parser();
    var builder = new this.xml2js.Builder();
    //var jsonQuery = this.jsonQuery;

    var self = this
    var xmlHasChanged = false
    xmlHasChanged
    const data = this.fse.readFileSync(file);
    //console.log(parser, builder, self)
    //console.log('jsonquery: '+jsonQuery("appMenu[* name!=Home]", { data: data }).value)

    parser.parseString(data, function (err2, fileXmlContent) {
      //console.log('filter: '+filter['replace']['executionUser'])
      //console.log(`Parsed XML \n` + self.util.inspect(fileXmlContent, false, null))   
      //console.log('filecontent: '+fileXmlContent) 
      if(fileXmlContent){
        Object.keys(fileXmlContent).forEach(eltKey => {
          console.log('eltKey '+eltKey)
          fileXmlContent[eltKey] = self.filterElement(fileXmlContent[eltKey],eltKey,filter,file)            
        });
        if (self.smmryUpdatedFiles[file] != null && self.smmryUpdatedFiles[file].updated === true) {
          var updatedObjectXml = builder.buildObject(fileXmlContent);
          self.fs.writeFileSync(file, updatedObjectXml)
          //console.log('Updated '+file)
        }
      }    
    })
  } 

  filterElement(elementValue,eltKey,filter,file){
    var self = this
    var jsonQuery = this.jsonQuery;
    
    filter.forEach(filterElement => {

      var token = elementValue
      //console.log('elementValue: '+JSON.stringify(elementValue))
      //console.log('filter: '+JSON.stringify(filter))

      if(filterElement['where']){
        console.log('abbiamo un where')
        if(filterElement['where'] === eltKey){
          token = [token]
        } else{
          token = jsonQuery(filterElement['where'], { data: elementValue })    
          //console.log('token jsonquery: '+JSON.stringify(token.value))
          if (token['value'] === undefined) return elementValue
        token = token.value
        }    
      } else{
        token = [token]
      }

      console.log('\ntoken: '+JSON.stringify(token))


      // REPLACE filter
      if(filterElement['replace']){
        Object.keys(filterElement['replace']).forEach(t => {
          //console.log('t: '+t)
          token.forEach(tk => {                    
            tk[t] = filterElement['replace'][t]
            if (self.smmryUpdatedFiles[file] == null)
              self.smmryUpdatedFiles[file] = { updated: true, excluded : {}}        
          })
        })
      }
      
      //FILTER filter
      if (filterElement['filter']) {
        //console.log('\n filterElementFilter.  '+filterElement['filter']+'\n')
        filterElement['filter'].forEach(valueToFilter => {
          //console.log('\n valuetofilter '+valueToFilter+'\n')
          token.forEach(tk => {
            if (typeof valueToFilter === 'object') {
              if (valueToFilter.jsonQuery){
                tk[valueToFilter] = jsonQuery(valueToFilter.expression, { data: tk })
              }             
              else 
                  delete tk[valueToFilter]
            } else {
              //console.log('\nelement to filter: '+tk[valueToFilter]+'\n')
              delete tk[valueToFilter]
            }
            if (self.smmryUpdatedFiles[file] == null)
                self.smmryUpdatedFiles[file] = { updated: true, excluded : {}}
          })        
        })
      }

      // DELETEPERMISSIONBLOCKS
      if (filterElement['deletePermissionBlocks']) {
        //console.log('\n deletePermissionBlocks.  '+filterElement['deletePermissionBlocks']+'\n')
        filterElement['deletePermissionBlocks'].forEach(valueToFilter => {
          //console.log('\n valuetofilter '+valueToFilter+'\n')
          token.forEach(tk => {            
            var arr = tk['userPermissions'];

            arr.forEach(tok => {
              if(tok['name'].includes(valueToFilter)){
                // console.log('beccato!!');
                // console.log('tok to delete: ', tok)
                // console.log('indexof: ', tk['userPermissions'].indexOf(tok))
                // console.log('pos to del: ', tk['userPermissions'][tk['userPermissions'].indexOf(tok)]);
                tk['userPermissions'].splice(tk['userPermissions'].indexOf(tok),1)
                if (self.smmryUpdatedFiles[file] == null){
                  self.smmryUpdatedFiles[file] = { updated: true, excluded : {}}
                }
              }
            })

            //console.log('dopo eliminazione: ', tk['userPermissions'])
            
                          
          })        
        })
      }

      // CONCAT:
      if (filterElement['concat']) {
        //console.log('concat')
        filterElement['concat'].forEach(valueToFilter => {
            token.push(valueToFilter)
        })
        //console.log('token dopo: ', token)
      }

      // DISABLEPERMISSIONS
      if (filterElement['disablePermissions']) {
        //console.log('\n disablePermissions.  '+filterElement['disablePermissions']+'\n')
        filterElement['disablePermissions'].forEach(valueToFilter => {
          //console.log('\n valuetofilter '+valueToFilter+'\n')
          //console.log('token: ', token)
          token.forEach(tk => {            
            var arr = tk['userPermissions'];

            arr.forEach(tok => {
              if(tok['name'].includes(valueToFilter)){
                // console.log('beccato!!');
                // console.log('tok to change: ', tok)
                // console.log('indexof: ', tk['userPermissions'].indexOf(tok))
                // console.log('pos to del: ', tk['userPermissions'][tk['userPermissions'].indexOf(tok)]);
                tok['enabled'] = ['false']
              }
            })

            //console.log('dopo eliminazione: ', tk['userPermissions'])
            
            if (self.smmryUpdatedFiles[file] == null){
              self.smmryUpdatedFiles[file] = { updated: true, excluded : {}}
            }                
          })        
        })
      }

      // DISABLETABS
      if (filterElement['disableTabs']) {
        //console.log('\n disableTabs.  '+filterElement['disableTabs']+'\n')
        filterElement['disableTabs'].forEach(valueToFilter => {
          //console.log('\n valuetofilter '+valueToFilter+'\n')
          //console.log('token: ', token)
          token.forEach(tk => {            
            var arr = tk['tabVisibilities'];

            arr.forEach(tok => {
              if(tok['tab'].includes(valueToFilter)){
                // console.log('beccato!!');
                // console.log('tok to change: ', tok)
                // console.log('indexof: ', tk['userPermissions'].indexOf(tok))
                // console.log('pos to del: ', tk['userPermissions'][tk['userPermissions'].indexOf(tok)]);
                tok['visibility'] = ['Hidden']
              }
            })

            //console.log('dopo eliminazione: ', tk['tabVisibilities'])
            
            if (self.smmryUpdatedFiles[file] == null){
              self.smmryUpdatedFiles[file] = { updated: true, excluded : {}}
            }                
          })        
        })
      }

      // ENABLETABS
      if (filterElement['enableTabs']) {
        //console.log('\n enableTabs.  '+filterElement['enableTabs']+'\n')
        filterElement['enableTabs'].forEach(valueToFilter => {
          //console.log('\n valuetofilter '+valueToFilter+'\n')
          token.forEach(tk => {            
            var arr = tk['tabVisibilities'];

            arr.forEach(tok => {
              if(tok['tab'].includes(valueToFilter)){
                // console.log('beccato!!');
                // console.log('tok to change: ', tok)
                // console.log('indexof: ', tk['userPermissions'].indexOf(tok))
                // console.log('pos to del: ', tk['userPermissions'][tk['userPermissions'].indexOf(tok)]);
                tok['visibility'] = ['DefaultOn']
              }
            })

            //console.log('dopo eliminazione: ', tk['tabVisibilities'])
            
            if (self.smmryUpdatedFiles[file] == null){
              self.smmryUpdatedFiles[file] = { updated: true, excluded : {}}
            }                
          })        
        })
      }

      // DISABLEOBJECTS
      if (filterElement['disableObjects']) {
        console.log('\n disableObjects.  '+filterElement['disableObjects']+'\n')
        filterElement['disableObjects'].forEach(valueToFilter => {
          console.log('\n valuetofilter '+valueToFilter+'\n')
          token.forEach(tk => {            
            var arr = tk['objectPermissions'];

            arr.forEach(tok => {
              if(tok['object'].includes(valueToFilter)){
                // console.log('beccato!!');
                // console.log('tok to change: ', tok)
                // console.log('indexof: ', tk['userPermissions'].indexOf(tok))
                // console.log('pos to del: ', tk['userPermissions'][tk['userPermissions'].indexOf(tok)]);
                tok['allowCreate'] = ['false']
                tok['allowDelete'] = ['false']
                tok['allowEdit'] = ['false']
                tok['allowRead'] = ['false']
                tok['modifyAllRecords'] = ['false']
                tok['viewAllRecords'] = ['false']                
              }
            })

            //console.log('dopo eliminazione: ', tk['tabVisibilities'])
            
            if (self.smmryUpdatedFiles[file] == null){
              self.smmryUpdatedFiles[file] = { updated: true, excluded : {}}
            }                
          })        
        })
      }

    });

    return elementValue

    // // Object case
    // if (typeof elementValue === 'object') {
    //   Object.keys(elementValue).forEach(eltKey => {
    //     let found = false
    //     // Browse filter exclude_list for elementValue
    //     filter.exclude_list.forEach( excludeDef => {
          
    //       if (excludeDef.type_tag === eltKey) {
    //         // Found matching type tag
    //         found = true
    //         console.log('\nFound type: '+eltKey )
    //         console.log(elementValue[eltKey]) 
    //         // Filter type values
    //         const typeValues = elementValue[eltKey]
    //         let newTypeValues = []
    //         typeValues.forEach(typeItem => {
    //           if (excludeDef.values.includes(typeItem[excludeDef.identifier_tag]) || excludeDef.values.includes(typeItem[excludeDef.identifier_tag][0])) {
    //             console.log('----- filtered '+typeItem[excludeDef.identifier_tag])
    //             if (self.smmryUpdatedFiles[file] == null)
    //               self.smmryUpdatedFiles[file] = { updated: true, excluded : {}}
    //             if (self.smmryUpdatedFiles[file].excluded[excludeDef.type_tag] == null) 
    //               self.smmryUpdatedFiles[file].excluded[excludeDef.type_tag] = []
    //             self.smmryUpdatedFiles[file].excluded[excludeDef.type_tag].push(typeItem[excludeDef.identifier_tag][0])
    //           }
    //           else {
    //             console.log('--- kept '+typeItem[excludeDef.identifier_tag])
    //             newTypeValues.push(typeItem)
    //           }
    //         });
    //         elementValue[eltKey] = newTypeValues
    //       }
    //     })
    //     if (!found)
    //       elementValue[eltKey] = self.filterElement(elementValue[eltKey],filter,file)
    //   })
    // }
    // // Array case
    // else if (Array.isArray(elementValue)) {
    //   let newElementValue = []
    //   elementValue.forEach(element => {
    //     element = self.filterElement(element,filter,file)
    //     newElementValue.push(element)
    //   })
    //   elementValue = newElementValue
    // }
     //return elementValue
  }

}