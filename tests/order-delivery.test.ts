import test from 'node:test';
import assert from 'node:assert/strict';
import {orderDelivery} from '../src/lib/order-delivery.ts';
test('paid delivery uses the assigned courier and tracking number',()=>{
 const value=orderDelivery({status:'paid',fulfillmentMethod:'epacket',shipment:{service:'ems_world',trackingNumber:'EE123TH',trackingUrl:null}});
 assert.deepEqual(value,{service:'ems_world',trackingNumber:'EE123TH',url:'https://track.thailandpost.co.th/?lang=en'});
});
test('failed, pending and cancelled orders do not advertise delivery',()=>{
 for(const status of ['pending','failed','expired','review'])assert.equal(orderDelivery({status,fulfillmentMethod:'ems_local'}),null);
 assert.equal(orderDelivery({status:'paid',cancellationStatus:'cancelled',fulfillmentMethod:'ems_local'}),null);
 assert.equal(orderDelivery({status:'paid',cancellationStatus:'requested',fulfillmentMethod:'ems_local',shipment:{trackingNumber:'EE123TH'}}),null);
});
test('pickup links to the supplied shop location without a tracking number',()=>{
 assert.deepEqual(orderDelivery({status:'paid',fulfillmentMethod:'pickup'}),{service:'pickup',trackingNumber:null,url:'https://maps.app.goo.gl/Q2KKz19MVEVE721Q9'});
});
test('missing tracking is explicit and unsafe supplied URLs are not exposed',()=>{
 assert.equal(orderDelivery({status:'paid',fulfillmentMethod:'flash',shipment:{trackingUrl:'javascript:alert(1)'}}),null);
 assert.equal(orderDelivery({status:'paid',fulfillmentMethod:'ems_local'}),null);
 assert.equal(orderDelivery({status:'paid',fulfillmentMethod:'ems_local',shipment:{trackingNumber:'EE123TH',trackingUrl:'javascript:alert(1)'}})?.url,'https://track.thailandpost.com');
});
