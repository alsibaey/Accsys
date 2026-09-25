// محاسب عدن PRO v1.0 - معمارية لـ 800+ صنف
// Engineer: 15 Years ERP Experience - Aden Market
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_KEYS = { PRODUCTS: 'ADEN_PROD_V2', SALES: 'ADEN_SALES_V2', CUSTOMERS: 'ADEN_CUST_V2', EXPENSES: 'ADEN_EXP_V2' };

export default function App() {
  const [tab, setTab] = useState('pos'); // pos, inventory, customers, reports
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  
  // Form
  const [f, setF] = useState({ barcode:'', name:'', cat:'غذائية', buy:'', sell:'', qty:'', minQty:'5' });

  useEffect(()=>{ init() },[]);
  const init = async () => {
    const p = JSON.parse(await AsyncStorage.getItem(DB_KEYS.PRODUCTS) || '[]');
    const s = JSON.parse(await AsyncStorage.getItem(DB_KEYS.SALES) || '[]');
    const c = JSON.parse(await AsyncStorage.getItem(DB_KEYS.CUSTOMERS) || '[]');
    setProducts(p); setSales(s); setCustomers(c);
  };
  const save = async (key, data) => await AsyncStorage.setItem(key, JSON.stringify(data));

  // هندسة التسعير: متوسط التكلفة المرجح
  const addOrUpdateProduct = async () => {
    if(!f.name || !f.sell) return Alert.alert('الاسم وسعر البيع إجباري');
    let list = [...products];
    let existing = list.find(x=>x.barcode===f.barcode && f.barcode!=='');
    if(existing){
      // تحديث متوسط التكلفة
      const totalQty = existing.qty + Number(f.qty||0);
      const totalCost = (existing.buy * existing.qty) + (Number(f.buy) * Number(f.qty||0));
      existing.buy = totalQty>0 ? totalCost/totalQty : existing.buy;
      existing.qty = totalQty;
      existing.sell = Number(f.sell);
      existing.name = f.name;
    } else {
      list.push({ id: Date.now(), barcode: f.barcode || 'AD'+Date.now().toString().slice(-6), name: f.name, cat: f.cat, buy: Number(f.buy)||0, sell: Number(f.sell), qty: Number(f.qty)||0, minQty: Number(f.minQty)||5, created: new Date().toISOString() });
    }
    setProducts(list); await save(DB_KEYS.PRODUCTS, list);
    setF({ barcode:'', name:'', cat:'غذائية', buy:'', sell:'', qty:'', minQty:'5' });
    Alert.alert('تم ✓');
  };

  const filteredProducts = useMemo(()=>{
    if(!search) return products;
    return products.filter(p=> p.name.includes(search) || p.barcode.includes(search) ).slice(0,100); // pagination لـ 800 صنف
  },[search, products]);

  const addToCart = (p) => {
    if(p.qty<=0) return Alert.alert('نفذ المخزون');
    setCart([...cart, {...p, cartId: Date.now()+Math.random()}]);
  };
  const checkout = async (payType='نقدي', customerName='') => {
    if(cart.length===0) return;
    const total = cart.reduce((a,b)=>a+b.sell,0);
    const cogs = cart.reduce((a,b)=>a+b.buy,0);
    // خصم مخزون
    let newProducts = products.map(pr=>{
      const count = cart.filter(c=>c.id===pr.id).length;
      return count ? {...pr, qty: pr.qty-count} : pr;
    });
    const invoice = { id: Date.now(), no: 'INV-'+Date.now().toString().slice(-6), date: new Date().toLocaleString('ar-YE'), items: cart, total, profit: total-cogs, payType, customer: customerName };
    const newSales = [...sales, invoice];
    setProducts(newProducts); setSales(newSales); setCart([]);
    await save(DB_KEYS.PRODUCTS, newProducts); await save(DB_KEYS.SALES, newSales);
    // ديون
    if(payType==='آجل' && customerName){
      let cust = customers.find(c=>c.name===customerName);
      if(cust){ cust.debt += total; } else { customers.push({id: Date.now(), name: customerName, debt: total}); }
      setCustomers([...customers]); await save(DB_KEYS.CUSTOMERS, [...customers]);
    }
    Alert.alert(`فاتورة ${invoice.no}\nالإجمالي: ${total} ر.ي\nالربح: ${total-cogs} ر.ي`);
  };

  const stats = useMemo(()=>{
    return {
      totalSales: sales.reduce((a,b)=>a+b.total,0),
      totalProfit: sales.reduce((a,b)=>a+b.profit,0),
      stockValueBuy: products.reduce((a,b)=>a+(b.buy*b.qty),0),
      stockValueSell: products.reduce((a,b)=>a+(b.sell*b.qty),0),
      lowStock: products.filter(p=>p.qty <= p.minQty).length,
      deadStock: products.filter(p=>p.qty>0 && !sales.some(s=>s.items.some(i=>i.id===p.id))).length
    }
  },[products, sales]);

  return (
    <View style={{flex:1, backgroundColor:'#f5f5f5', paddingTop:35}}>
      <View style={{flexDirection:'row', justifyContent:'space-around', backgroundColor:'#0d47a1', padding:10}}>
        {[
          {k:'pos', t:'الكاشير'},
          {k:'inventory', t:`المخزون (${products.length})`},
          {k:'customers', t:'الديون'},
          {k:'reports', t:'التقارير'}
        ].map(b=> <TouchableOpacity key={b.k} onPress={()=>setTab(b.k)} style={{padding:8, backgroundColor: tab===b.k?'#fff':'transparent', borderRadius:8}}><Text style={{color: tab===b.k?'#0d47a1':'#fff', fontWeight:'bold'}}>{b.t}</Text></TouchableOpacity>)}
      </View>

      {tab==='pos' && <View style={{flex:1, padding:10}}>
        <TextInput placeholder="ابحث باركود أو اسم (ل 800 صنف)" value={search} onChangeText={setSearch} style={{backgroundColor:'#fff', padding:12, borderRadius:8, marginBottom:8}}/>
        <FlatList data={filteredProducts} keyExtractor={i=>i.id.toString()} style={{flex:1}} renderItem={({item})=>
          <View style={{flexDirection:'row', justifyContent:'space-between', backgroundColor:'#fff', padding:10, marginBottom:4, borderRadius:6}}>
            <View><Text style={{fontWeight:'bold'}}>{item.name}</Text><Text style={{fontSize:12}}>{item.barcode} | متبقي: {item.qty}</Text></View>
            <TouchableOpacity onPress={()=>addToCart(item)} style={{backgroundColor:'#2e7d32', padding:8, borderRadius:6}}><Text style={{color:'#fff'}}>{item.sell} ر.ي +</Text></TouchableOpacity>
          </View>
        }/>
        <View style={{backgroundColor:'#fff', padding:10, borderRadius:10, marginTop:5}}>
          <Text>السلة: {cart.length} | المجموع: {cart.reduce((a,b)=>a+b.sell,0)} ر.ي</Text>
          <View style={{flexDirection:'row', gap:5, marginTop:5}}>
            <TouchableOpacity onPress={()=>checkout('نقدي')} style={{flex:1, backgroundColor:'#0d47a1', padding:12, borderRadius:8, alignItems:'center'}}><Text style={{color:'#fff', fontWeight:'bold'}}>بيع نقدي</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>{ const name=prompt('اسم العميل للآجل؟'); if(name) checkout('آجل', name)}} style={{flex:1, backgroundColor:'#ef6c00', padding:12, borderRadius:8, alignItems:'center'}}><Text style={{color:'#fff', fontWeight:'bold'}}>بيع آجل</Text></TouchableOpacity>
          </View>
          <TouchableOpacity onPress={()=>setCart([])}><Text style={{color:'red', textAlign:'center', marginTop:5}}>إفراغ السلة</Text></TouchableOpacity>
        </View>
      </View>}

      {tab==='inventory' && <ScrollView style={{padding:10}}>
        <Text style={{fontWeight:'bold', fontSize:16}}>إضافة صنف جديد (متوسط تكلفة تلقائي)</Text>
        <TextInput placeholder="باركود" value={f.barcode} onChangeText={v=>setF({...f, barcode:v})} style={{backgroundColor:'#fff', padding:10, marginVertical:3, borderRadius:6}}/>
        <TextInput placeholder="الاسم" value={f.name} onChangeText={v=>setF({...f, name:v})} style={{backgroundColor:'#fff', padding:10, marginVertical:3, borderRadius:6}}/>
        <View style={{flexDirection:'row', gap:5}}>
          <TextInput placeholder="شراء" value={f.buy} onChangeText={v=>setF({...f, buy:v})} keyboardType="numeric" style={{flex:1, backgroundColor:'#fff', padding:10, borderRadius:6}}/>
          <TextInput placeholder="بيع" value={f.sell} onChangeText={v=>setF({...f, sell:v})} keyboardType="numeric" style={{flex:1, backgroundColor:'#fff', padding:10, borderRadius:6}}/>
          <TextInput placeholder="كمية" value={f.qty} onChangeText={v=>setF({...f, qty:v})} keyboardType="numeric" style={{flex:1, backgroundColor:'#fff', padding:10, borderRadius:6}}/>
        </View>
        <TouchableOpacity onPress={addOrUpdateProduct} style={{backgroundColor:'#0d47a1', padding:12, borderRadius:8, marginTop:8, alignItems:'center'}}><Text style={{color:'#fff', fontWeight:'bold'}}>حفظ - يحسب المتوسط تلقائياً</Text></TouchableOpacity>
        <Text style={{marginTop:15, color:'#c62828'}}>⚠️ نواقص ({stats.lowStock}) | راكد ({stats.deadStock})</Text>
        {products.filter(p=>p.qty<=p.minQty).map(p=><Text key={p.id} style={{backgroundColor:'#ffcdd2', padding:6, marginTop:2}}>🔴 {p.name} - باقي {p.qty}</Text>)}
      </ScrollView>}

      {tab==='customers' && <ScrollView style={{padding:10}}>
        <Text style={{fontWeight:'bold', fontSize:16}}>دفتر الديون - {customers.length} عميل</Text>
        {customers.map(c=><View key={c.id} style={{backgroundColor:'#fff', padding:10, marginVertical:3, borderRadius:6, flexDirection:'row', justifyContent:'space-between'}}><Text>{c.name}</Text><Text style={{fontWeight:'bold'}}>{c.debt} ر.ي</Text></View>)}
        {customers.length===0 && <Text style={{marginTop:20, textAlign:'center'}}>لا يوجد ديون - ممتاز!</Text>}
      </ScrollView>}

      {tab==='reports' && <ScrollView style={{padding:10}}>
        <View style={{backgroundColor:'#fff', padding:15, borderRadius:10}}>
          <Text style={{fontWeight:'bold', fontSize:18, marginBottom:10}}>📊 قائمة الدخل</Text>
          <Text>إجمالي المبيعات: {stats.totalSales} ر.ي</Text>
          <Text>تكلفة البضاعة المباعة: {stats.totalSales - stats.totalProfit} ر.ي</Text>
          <Text style={{fontWeight:'bold', color:'#2e7d32'}}>مجمل الربح: {stats.totalProfit} ر.ي</Text>
          <Text style={{marginTop:10}}>قيمة المخزون بسعر الشراء: {stats.stockValueBuy} ر.ي</Text>
          <Text>قيمة المخزون بسعر البيع: {stats.stockValueSell} ر.ي</Text>
          <Text style={{fontWeight:'bold'}}>الربح المتوقع من المخزون الحالي: {stats.stockValueSell - stats.stockValueBuy} ر.ي</Text>
          <Text style={{marginTop:10}}>عدد الفواتير: {sales.length}</Text>
        </View>
        <TouchableOpacity onPress={async()=>{ await AsyncStorage.clear(); setProducts([]); setSales([]); setCustomers([]); Alert.alert('تم تصفير النظام - نسخ احتياطي قبل؟')}} style={{backgroundColor:'#b71c1c', padding:12, borderRadius:8, marginTop:20, alignItems:'center'}}><Text style={{color:'#fff'}}>تصفير النظام (للتأسيس الجديد)</Text></TouchableOpacity>
      </ScrollView>}
    </View>
  );
}