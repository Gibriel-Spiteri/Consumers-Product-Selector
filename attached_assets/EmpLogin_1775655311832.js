nlapiLogExecution("audit","FLOStart",new Date().getTime());
function suitelet(request,response){
	try{    
		var email=request.getParameter('email');
		var password=request.getParameter('password');
		var type=request.getParameter('type');
		var empid=request.getParameter('id');
     // email='lewalsh@consumersmail.com';
     // password = 'consumers';
     // type = 'none';
	 // empid= 6;
		nlapiLogExecution('debug','email password',email+' '+password);
		nlapiLogExecution('debug','type =',type+' empid '+empid);
		if(type=='id')
		{

			var employeeSearch = nlapiSearchRecord("employee",null,
			[
			   ["internalid","is",empid]
			], 
			[
			   new nlobjSearchColumn("firstname",null,null),
			   new nlobjSearchColumn("lastname",null,null),
			   new nlobjSearchColumn("internalid",null,null) 
			]
			);
			if(employeeSearch)
			{
				var empname=employeeSearch[0].getValue('lastname')+', '+employeeSearch[0].getValue('firstname');
				response.write(empname);
			}
		}
		else
		{
		
		var employeeSearch = nlapiSearchRecord("employee",null,
			[
			   ["email","is",email]
			], 
			[
			   new nlobjSearchColumn("entityid",null,null).setSort(false), 			   
			   new nlobjSearchColumn("email",null,null), 			  
			   new nlobjSearchColumn("giveaccess",null,null), 	
			   new nlobjSearchColumn("custentity_webstorepassword",null,null), 
			   new nlobjSearchColumn("custentity_webstore_access",null,null),
			   new nlobjSearchColumn("firstname",null,null),
			   new nlobjSearchColumn("lastname",null,null),
			   new nlobjSearchColumn("internalid",null,null) 
			]
			);
			if(employeeSearch)
			{
				var access=employeeSearch[0].getValue('giveaccess');
nlapiLogExecution('debug','access ',access);
				if(access=='T'){
					var isLogged=employeeSearch[0].getValue('custentity_webstore_access');
					//if(isLogged!='T')
					//{
						var match=employeeSearch[0].getValue('custentity_webstorepassword');
						var empname=employeeSearch[0].getValue('internalid');
						//var empname=employeeSearch[0].getValue('firstname')+' '+employeeSearch[0].getValue('lastname');
						//var decrypted= nlapiDecrypt(match, "aes", "48656C6C6F0B0B0B0B0B0B0B0B0B0B0B");
						if(match==password)
						{
							nlapiSubmitField('employee',employeeSearch[0].getId(),'custentity_webstore_access','T');
							response.write('logged##'+empname); // Gave access
						}else{
							response.write('PNM'); //Password not match
						}
						nlapiLogExecution('debug','empname=',empname);
					//}else{
					//	response.write('logged');// Employee already logged in
					//}
				}else{
					response.write('NEA');// No Employee access
				}
			}else{
					response.write('NEA');// No Employee found
				}
			}
	   }
	catch(e){
		
		nlapiLogExecution('debug','error',e);
	}
}
	   